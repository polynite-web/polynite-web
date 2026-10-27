/* PLAY TOGETHER - the browser side of Browser Host (protocol/polynod-server/PLAN.md, step 7a).
 *
 * The host creates a session through the Worker (POST /api/play/session), keeps the secret it
 * gets back, and opens a signaling socket. A guest opens the same socket with the session id
 * from the invite link. The Worker only relays SDP and ICE; once a peer-to-peer DataChannel
 * "pn" is open (reliable, ordered), the guest's signaling socket is closed and everything goes
 * browser to browser. STUN only, no TURN: some networks cannot connect directly, and that is
 * said plainly (code p2p_failed) rather than hidden.
 *
 * The engine reads events from a queue, like its WebSocket bridge (pn_net.hh):
 *   {type:'state', state}            idle | creating | waiting | connecting | connected | ended | failed
 *   {type:'session', session, invite, expires_at}   host: the session exists
 *   {type:'peer', peer, name}        host: a guest asks to come in (an RTCPeerConnection starts)
 *   {type:'open', peer}              a DataChannel is open (host: per guest; guest: peer 'host')
 *   {type:'message', peer, data}     text, or Uint8Array for binary
 *   {type:'left', peer}              a peer's DataChannel closed
 *   {type:'error', code, message}    human message; code for the engine
 * Nothing about ICE, STUN or SDP reaches a person: the codes are mapped to plain words by the UI.
 */
(function(){
  'use strict';
  const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];
  const P2P_TIMEOUT_MS = 15000;
  const SEND_HIGH = 1 << 20;          /* a DataChannel with this much unsent is too slow: cut, like pnserver */
  const words = {
    play_disabled: 'Playing together is not available right now.',
    unavailable: 'Could not reach Polynite. Check your connection and try again.',
    rate_limit: 'Too many sessions created in the last hour. Try again later.',
    ended: 'This session has ended.',
    full: 'This session is full.',
    refused: 'The host did not let you in.',
    host_closed: 'The host ended the session.',
    host_away: 'The host is away. Waiting for them to come back...',
    p2p_failed: 'Your network and the host\'s could not connect directly. Try again, or use a Polynod server.',
    too_slow: 'The connection is too slow.',
    signal_lost: 'Lost the connection to Polynite before the game could start.',
  };
  const S = { api: '', role: '', session: '', secret: '', ws: null, peers: new Map(), q: [], state: 'idle', name: '', echo: false, invite: '', copied: 0, refused: 0 };
  /* ?play_api=<origin>: another signaling Worker for this tab (staging, a local wrangler dev) - only
     Polynite's own or this machine's, so a link cannot send the handshake elsewhere; kept for the tab */
  const playApi = (() => {
    const ok = (a) => /^https:\/\/api(-staging)?\.polynite\.io$|^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(a || '') ? a : '';
    try {
      const a = ok(new URL(location.href).searchParams.get('play_api'));
      if (a) sessionStorage.setItem('pn_play_api', a);
      return a || ok(sessionStorage.getItem('pn_play_api'));
    } catch { return ''; }
  })();
  const apiBase = (api) => api || playApi || (globalThis.__pnAcct && globalThis.__pnAcct.api) || globalThis.__pnApiBase || '';
  /* the invite, where this app lives: /play/<id> at the site's root, /dev/play/<id> beside a dev build;
     the site turns either into ?play=<id> (_redirects); a tab on another Worker hands it on */
  const inviteFor = (session) => location.origin + location.pathname.replace(/[^/]*$/, '') + 'play/' + session;
  const inviteQuery = () => playApi ? '?play_api=' + encodeURIComponent(playApi) : '';
  const push = (e) => { S.q.push(e); };
  const setState = (st) => { if (S.state !== st) { S.state = st; push({ type: 'state', state: st }); } };
  const fail = (code, msg) => { push({ type: 'error', code, message: msg || words[code] || code }); };
  const wsUrl = (path) => S.api.replace(/^http/, 'ws') + path;

  function signal(onWelcome) {
    const ws = new WebSocket(wsUrl('/api/play/' + S.session + '/ws'));
    S.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(S.role === 'host' ? { t: 'sig.hello', role: 'host', secret: S.secret, name: S.name } : { t: 'sig.hello', role: 'guest', name: S.name }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      switch (m.t) {
        case 'sig.welcome': if (onWelcome) onWelcome(m); break;
        case 'sig.peer': if (S.role === 'host') hostOffer(m.peer, m.name); break;
        case 'sig.offer': if (S.role === 'guest') guestAnswer(m.sdp); break;
        case 'sig.answer': { const p = S.peers.get(m.from); if (p) p.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(() => {}); break; }
        case 'sig.ice': { const p = S.role === 'host' ? S.peers.get(m.from) : S.peers.get('host'); if (p) p.pc.addIceCandidate(m.candidate || null).catch(() => {}); break; }
        case 'sig.left': { const p = S.peers.get(m.peer); if (p && !p.open) { closePeer(m.peer); } break; }
        case 'sig.host_away': if (S.role === 'guest' && S.state !== 'connected') push({ type: 'error', code: 'host_away', message: words.host_away }); break;
        case 'sig.host': break;
        case 'sig.closed': fail(m.reason, words[m.reason]); if (S.role === 'guest' && S.state !== 'connected') setState('ended'); if (S.role === 'host' || m.reason === 'host_closed') setState('ended'); break;
        case 'sig.error': fail(m.code, words[m.code] || m.message); break;
      }
    };
    ws.onclose = () => { if (S.ws === ws) S.ws = null; if (S.role === 'guest' && S.state === 'connecting') { fail('signal_lost'); setState('failed'); } };
    ws.onerror = () => {};
  }
  function sig(m) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(m)); }

  function newPeer(id, name) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const p = { id, name, pc, dc: null, open: false, timer: 0 };
    S.peers.set(id, p);
    pc.onicecandidate = (ev) => sig(S.role === 'host' ? { t: 'sig.ice', to: id, candidate: ev.candidate ? ev.candidate.toJSON() : null } : { t: 'sig.ice', candidate: ev.candidate ? ev.candidate.toJSON() : null });
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { closePeer(id); fail('p2p_failed'); if (S.role === 'guest') setState('failed'); } };
    p.timer = setTimeout(() => { if (!p.open) { closePeer(id); fail('p2p_failed'); if (S.role === 'guest') setState('failed'); } }, P2P_TIMEOUT_MS);
    return p;
  }
  function wire(p, dc) {
    p.dc = dc; dc.binaryType = 'arraybuffer';
    dc.onopen = () => {
      p.open = true; clearTimeout(p.timer);
      push({ type: 'open', peer: p.id, name: p.name });
      if (S.role === 'guest') { setState('connected'); sig({ t: 'sig.bye' }); }   /* the Worker is no longer needed */
    };
    dc.onmessage = (ev) => {
      /* the 7a echo test, answered here: a guest tab in the background has no frames for its engine */
      if (S.echo && typeof ev.data === 'string' && ev.data.startsWith('echo:')) { try { dc.send('back:' + ev.data.slice(5)); } catch {} return; }
      push({ type: 'message', peer: p.id, data: typeof ev.data === 'string' ? ev.data : new Uint8Array(ev.data) });
    };
    dc.onclose = () => { if (p.open) { p.open = false; push({ type: 'left', peer: p.id }); if (S.role === 'guest') setState('ended'); } S.peers.delete(p.id); };
  }
  function closePeer(id) {
    const p = S.peers.get(id); if (!p) return;
    clearTimeout(p.timer);
    /* an old connection says nothing more: its late events would speak for the new one */
    if (p.dc) p.dc.onopen = p.dc.onmessage = p.dc.onclose = null;
    p.pc.onicecandidate = p.pc.onconnectionstatechange = p.pc.ondatachannel = null;
    try { p.dc && p.dc.close(); } catch {}
    try { p.pc.close(); } catch {}
    S.peers.delete(id);
  }
  async function hostOffer(peer, name) {
    const p = newPeer(peer, name);
    push({ type: 'peer', peer, name });
    wire(p, p.pc.createDataChannel('pn', { ordered: true }));
    try { await p.pc.setLocalDescription(await p.pc.createOffer()); sig({ t: 'sig.offer', to: peer, sdp: p.pc.localDescription.sdp }); }
    catch { closePeer(peer); fail('p2p_failed'); }
  }
  async function guestAnswer(sdp) {
    let p = S.peers.get('host');
    if (!p) { p = newPeer('host', 'Host'); p.pc.ondatachannel = (ev) => { if (ev.channel.label === 'pn') wire(p, ev.channel); }; }
    try {
      await p.pc.setRemoteDescription({ type: 'offer', sdp });
      await p.pc.setLocalDescription(await p.pc.createAnswer());
      sig({ t: 'sig.answer', sdp: p.pc.localDescription.sdp });
    } catch { closePeer('host'); fail('p2p_failed'); setState('failed'); }
  }

  const PnPlay = {
    /* host: a new session, then guests as they come */
    async host({ api, name }) {
      PnPlay.close(); S.api = apiBase(api); S.role = 'host'; S.name = name || 'Host'; setState('creating');
      let r, j;
      try { r = await fetch(S.api + '/api/play/session', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name || '' }) }); j = await r.json(); }
      catch { fail('unavailable'); setState('failed'); return; }
      if (!r.ok) { fail(j.error || 'unavailable', j.message); setState('failed'); return; }
      S.session = j.session; S.secret = j.host_secret; S.invite = inviteFor(j.session);
      push({ type: 'session', session: j.session, invite: S.invite, expires_at: j.expires_at });
      signal(() => setState('waiting'));
    },
    /* guest: the session from the invite link */
    async join({ api, session, name, echo }) {
      PnPlay.close(); S.api = apiBase(api); S.role = 'guest'; S.session = session; S.name = name || 'Guest'; S.echo = !!echo;
      if (!/^[0-9a-f-]{36}$/.test(session || '')) { fail('ended'); setState('failed'); return; }
      setState('connecting');
      /* a refused WebSocket says nothing about why: ask first (a read, nothing written) */
      try {
        const r = await fetch(S.api + '/api/play/' + session, { credentials: 'include' });
        const j = await r.json().catch(() => ({}));
        if (S.session !== session) return;   /* closed or replaced meanwhile */
        if (r.status === 404 || j.exists === false) { fail('ended'); setState('failed'); return; }
        if (!r.ok) { fail(j.error === 'play_disabled' ? 'play_disabled' : 'unavailable'); setState('failed'); return; }
      } catch { fail('unavailable'); setState('failed'); return; }
      signal(null);
    },
    /* to one peer, or '*' to every open one; false when nothing could take it */
    send(peer, data) {
      let n = 0;
      for (const p of S.peers.values()) {
        if (!p.open || (peer !== '*' && p.id !== peer)) continue;
        if (p.dc.bufferedAmount > SEND_HIGH) { closePeer(p.id); push({ type: 'left', peer: p.id }); fail('too_slow'); continue; }
        try { p.dc.send(data); n++; } catch {}
      }
      return n > 0;
    },
    next() { return S.q.shift() || null; },
    refuse(peer) { sig({ t: 'sig.refuse', peer }); closePeer(peer); },
    /* the host's room closed this guest: its channel goes, quietly (the room already knows) */
    drop(peer) { closePeer(peer); },
    /* bytes from the engine's heap, as one binary message */
    sendBytes(peer, u8) { return PnPlay.send(peer, u8); },
    close() {
      if (S.role === 'host') sig({ t: 'sig.close' });
      for (const id of [...S.peers.keys()]) closePeer(id);
      if (S.ws) { S.ws.onopen = S.ws.onmessage = S.ws.onclose = null; try { S.ws.close(1000); } catch {} }
      S.ws = null; S.session = ''; S.secret = ''; S.role = ''; S.q.length = 0; S.state = 'idle'; S.echo = false; S.invite = ''; S.copied = S.refused = 0;
    },
    /* the invite link: a SECOND tap after the session exists (the browser wants a fresh gesture) */
    copyInvite() {
      if (!S.invite) return;
      try {
        const ta = document.createElement('textarea'); ta.value = S.invite; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.left = '-1000px'; document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy'); document.body.removeChild(ta);
        if (ok) { S.copied = Date.now(); return; }
      } catch {}
      try { navigator.clipboard.writeText(S.invite).then(() => { S.copied = Date.now(); }, () => { S.refused = Date.now(); }); } catch { S.refused = Date.now(); }
    },
    canShare() { return typeof navigator.share === 'function'; },
    shareInvite() { if (S.invite && typeof navigator.share === 'function') navigator.share({ title: 'Play with me on Polynite', url: S.invite }).catch(() => {}); },
    copiedAgo() { return S.copied ? Date.now() - S.copied : -1; },
    refusedAgo() { return S.refused ? Date.now() - S.refused : -1; },
    /* a link opened from an invite: ?play=<id> (and it leaves the address, so a reload is a choice) */
    /* "<session> <invite>": the invite (?i=) says what the host lets this link do */
    takeInvite() {
      try {
        const u = new URL(location.href), id = u.searchParams.get('play'), inv = u.searchParams.get('i') || '';
        if (!id) return '';
        u.searchParams.delete('play'); u.searchParams.delete('i'); history.replaceState(null, '', u.toString());
        if (!/^[0-9a-f-]{36}$/.test(id)) return '';
        return /^[A-Za-z0-9_-]{8,32}$/.test(inv) ? id + ' ' + inv : id;
      } catch { return ''; }
    },
    setInvite(url) { S.invite = String(url || '') + (url ? inviteQuery() : ''); },
    status() { return { state: S.state, role: S.role, session: S.session, peers: [...S.peers.values()].map(p => ({ peer: p.id, name: p.name, open: p.open })) }; },
  };
  globalThis.PnPlay = PnPlay;
})();
