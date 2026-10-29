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
 *   {type:'state', state}            idle | creating | waiting | connecting | connected | reconnecting | ended | failed
 *   {type:'session', session, invite, expires_at}   host: the session exists
 *   {type:'peer', peer, name}        host: a guest asks to come in (an RTCPeerConnection starts)
 *   {type:'open', peer}              a DataChannel is open (host: per guest; guest: peer 'host')
 *   {type:'message', peer, data}     text, or Uint8Array for binary
 *   {type:'left', peer}              a peer's DataChannel closed
 *   {type:'error', code, message}    human message; code for the engine
 * Nothing about ICE, STUN or SDP reaches a person: the codes are mapped to plain words by the UI.
 *
 * A GUEST THAT LOSES THE HOST (PLAN.md 7f) does not conclude: the channel closed, or stayed
 * "disconnected" for LOST_AFTER_MS, and it signals again, as when it came (a new peer for the
 * host), for RECONNECT_MS - the time the host's room keeps its place. The engine then says
 * hello with its resume token. Only the session's real end (sig.closed) or that delay ends it.
 *
 * TWO CHANNELS PER GUEST (PLAN.md 7h): "pn", reliable and ordered, for everything; "pnu",
 * unordered and never retransmitted, for the room's binary snapshots (peers, bodies) - a late
 * snapshot is worth less than the next one, and must not hold the others back. The engine drops
 * a snapshot older than the last of its kind. Without "pnu", binary goes on "pn" as before.
 *
 * THE HOST'S TAB IN THE BACKGROUND has no frames: the room would stop. A timer ticks it while
 * hidden (as often as the browser allows), the title says so, and the engine is told how long.
 *
 * CHECKPOINTS (7h): the host sends its scene to the session (sig.checkpoint, in parts); the
 * Worker keeps the last one while the session lives.
 *
 * HOST MIGRATION (7i): the host tells the Worker the hashes of its successors' tokens
 * (setSuccessors); it can step down (stepDown) and the session goes on. A successor takes over
 * (takeOver) with its token: hello as the host; while the old host is still there it tries again
 * (TAKEOVER_TRIES), and if another successor got there first it becomes a guest of that one.
 */
(function(){
  'use strict';
  const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];
  const P2P_TIMEOUT_MS = 15000;
  const LOST_AFTER_MS = 4000;         /* "disconnected" this long: the link is lost (ICE says "failed" only after ~30 s) */
  const RECONNECT_MS = 30000;         /* a guest tries to come back this long (pns_core PNS_RESUME_MS) */
  const RESIGNAL_MS = 2000;
  const CHECKPOINT_PART = 12000;
  const TAKEOVER_TRIES = 12, TAKEOVER_EVERY_MS = 1000;      /* characters per sig.checkpoint part (the Worker reads 16 KB messages) */
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
    host_lost: 'Lost the host: the game has ended.',
  };
  const S = { api: '', role: '', session: '', secret: '', ws: null, peers: new Map(), q: [], state: 'idle', name: '', echo: false, invite: '', copied: 0, refused: 0, until: 0, retry: 0, comebacks: 0,
    hiddenAt: 0, tick: 0, title: '', ckpt: null, unreliable: 0, succession: '', tries: 0, epoch: 1 };
  const sha256hex = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('');
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
    ws.onopen = () => ws.send(JSON.stringify(S.role === 'host'
      ? (S.succession ? { t: 'sig.hello', role: 'host', succession: S.succession, name: S.name } : { t: 'sig.hello', role: 'host', secret: S.secret, name: S.name })
      : { t: 'sig.hello', role: 'guest', name: S.name }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      switch (m.t) {
        case 'sig.welcome':
          if (m.epoch) S.epoch = m.epoch;
          if (S.succession && m.role === 'host' && m.host_secret) {   /* we are the host now (7i) */
            S.secret = m.host_secret; S.succession = ''; S.tries = 0; S.invite = inviteFor(S.session);
            push({ type: 'session', session: S.session, invite: S.invite, expires_at: m.expires_at });
            push({ type: 'took_over', peer: String(m.epoch || 0), name: '' });
            setState('waiting');
          }
          if (onWelcome) onWelcome(m); break;
        case 'sig.peer': if (S.role === 'host') hostOffer(m.peer, m.name); break;
        case 'sig.offer': if (S.role === 'guest') guestAnswer(m.sdp); break;
        case 'sig.answer': { const p = S.peers.get(m.from); if (p) p.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(() => {}); break; }
        case 'sig.ice': { const p = S.role === 'host' ? S.peers.get(m.from) : S.peers.get('host'); if (p) p.pc.addIceCandidate(m.candidate || null).catch(() => {}); break; }
        case 'sig.left': { const p = S.peers.get(m.peer); if (p && !p.open) { closePeer(m.peer); } break; }
        case 'sig.host_away': if (S.role === 'guest' && S.state !== 'connected') push({ type: 'error', code: 'host_away', message: words.host_away }); break;
        case 'sig.host': break;
        case 'sig.checkpointed': S.ckpt = { rev: m.rev, at: m.saved_at, bytes: m.bytes }; push({ type: 'checkpointed', peer: String(m.rev), name: String(m.bytes || 0) }); break;
        case 'sig.closed': fail(m.reason, words[m.reason]); if (S.role === 'guest' && S.state !== 'connected') { clearTimeout(S.retry); S.until = 0; setState('ended'); } if (S.role === 'host' || m.reason === 'host_closed') setState('ended'); break;
        case 'sig.error':
          if (S.succession && (m.code === 'host_present' || m.code === 'not_successor')) { takeOverAgain(m.code); break; }
          fail(m.code, words[m.code] || m.message); break;
        case 'sig.successors_ok': break;
        case 'sig.stepped_down':   /* the session goes on without us as its host */
          S.role = ''; for (const id of [...S.peers.keys()]) closePeer(id);
          push({ type: 'stepped_down', peer: '', name: '' }); break;
      }
    };
    ws.onclose = () => {
      if (S.ws === ws) S.ws = null;
      if (S.role === 'guest' && S.state === 'connecting') { fail('signal_lost'); setState('failed'); }
      if (S.role === 'guest' && S.state === 'reconnecting') resignalLater();   /* no network yet: again */
    };
    ws.onerror = () => {};
  }
  function sig(m) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(m)); }

  function newPeer(id, name) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const p = { id, name, pc, dc: null, open: false, timer: 0 };
    S.peers.set(id, p);
    pc.onicecandidate = (ev) => sig(S.role === 'host' ? { t: 'sig.ice', to: id, candidate: ev.candidate ? ev.candidate.toJSON() : null } : { t: 'sig.ice', candidate: ev.candidate ? ev.candidate.toJSON() : null });
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') { clearTimeout(p.lost); p.lost = 0; return; }
      if (st === 'disconnected' && p.open && !p.lost) p.lost = setTimeout(() => { if (pc.connectionState !== 'connected') lost(id); }, LOST_AFTER_MS);
      if (st === 'failed') { if (p.open) lost(id); else noLink(id); }
    };
    p.timer = setTimeout(() => { if (!p.open) noLink(id); }, P2P_TIMEOUT_MS);
    return p;
  }
  /* the unordered channel: only binary snapshots, and it says nothing about the peer coming or going */
  function wireU(p, dc) {
    p.udc = dc; dc.binaryType = 'arraybuffer';
    dc.onmessage = (ev) => { if (typeof ev.data !== 'string') { S.unreliable++; push({ type: 'message', peer: p.id, data: new Uint8Array(ev.data) }); } };
    dc.onclose = () => { if (p.udc === dc) p.udc = null; };
  }
  function wire(p, dc) {
    p.dc = dc; dc.binaryType = 'arraybuffer';
    dc.onopen = () => {
      p.open = true; clearTimeout(p.timer);
      push({ type: 'open', peer: p.id, name: p.name });
      if (S.role === 'guest') {
        if (S.state === 'reconnecting') S.comebacks++;
        clearTimeout(S.retry); S.retry = 0; S.until = 0;
        setState('connected'); sig({ t: 'sig.bye' });   /* the Worker is no longer needed */
      }
    };
    dc.onmessage = (ev) => {
      /* the 7a echo test, answered here: a guest tab in the background has no frames for its engine */
      if (S.echo && typeof ev.data === 'string' && ev.data.startsWith('echo:')) { try { dc.send('back:' + ev.data.slice(5)); } catch {} return; }
      push({ type: 'message', peer: p.id, data: typeof ev.data === 'string' ? ev.data : new Uint8Array(ev.data) });
    };
    dc.onclose = () => { if (p.open) lost(p.id); else S.peers.delete(p.id); };
  }
  /* a channel that worked is gone: the host forgets the guest (its room keeps the place); the guest tries to come back */
  function lost(id) {
    const p = S.peers.get(id); if (!p) return;
    const was = p.open;
    closePeer(id);
    if (was) push({ type: 'left', peer: id });
    if (S.role === 'guest') comeBack();
  }
  /* a channel that never opened */
  function noLink(id) {
    closePeer(id);
    if (S.role === 'guest' && S.state === 'reconnecting') { resignalLater(); return; }
    fail('p2p_failed'); if (S.role === 'guest') setState('failed');
  }
  function comeBack() {
    if (S.state !== 'reconnecting') { S.until = Date.now() + RECONNECT_MS; setState('reconnecting'); }
    resignal();
  }
  async function resignal() {
    clearTimeout(S.retry); S.retry = 0;
    if (S.role !== 'guest' || S.state !== 'reconnecting') return;
    if (Date.now() > S.until) { fail('host_lost'); setState('ended'); return; }
    for (const id of [...S.peers.keys()]) closePeer(id);
    if (S.ws) { S.ws.onopen = S.ws.onmessage = S.ws.onclose = null; try { S.ws.close(1000); } catch {} S.ws = null; }
    /* the session first (a read): ended is said at once; no network is tried again */
    const session = S.session;
    try {
      const r = await fetch(S.api + '/api/play/' + session, { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (S.session !== session || S.state !== 'reconnecting') return;
      if (r.status === 404 || j.exists === false) { S.until = 0; fail('ended'); setState('ended'); return; }
    } catch { if (S.state === 'reconnecting') resignalLater(); return; }
    signal(null);
    S.retry = setTimeout(() => { if (S.state === 'reconnecting') resignal(); }, P2P_TIMEOUT_MS);   /* no channel by then: once more */
  }
  function resignalLater() { clearTimeout(S.retry); S.retry = setTimeout(resignal, RESIGNAL_MS); }
  /* a takeover refused: the old host is still there (try again), or someone else is the host now */
  function takeOverAgain(code) {
    if (S.ws) { S.ws.onopen = S.ws.onmessage = S.ws.onclose = null; try { S.ws.close(1000); } catch {} S.ws = null; }
    if (code === 'host_present' && ++S.tries < TAKEOVER_TRIES) { clearTimeout(S.retry); S.retry = setTimeout(() => signal(null), TAKEOVER_EVERY_MS); return; }
    S.succession = ''; S.tries = 0; S.role = 'guest';   /* another successor won: be its guest */
    push({ type: 'takeover_failed', peer: '', name: code });
    S.until = Date.now() + RECONNECT_MS; S.state = 'reconnecting'; resignal();
  }
  function closePeer(id) {
    const p = S.peers.get(id); if (!p) return;
    clearTimeout(p.timer); clearTimeout(p.lost);
    /* an old connection says nothing more: its late events would speak for the new one */
    if (p.dc) p.dc.onopen = p.dc.onmessage = p.dc.onclose = null;
    if (p.udc) { p.udc.onmessage = p.udc.onclose = null; try { p.udc.close(); } catch {} }
    p.pc.onicecandidate = p.pc.onconnectionstatechange = p.pc.ondatachannel = null;
    try { p.dc && p.dc.close(); } catch {}
    try { p.pc.close(); } catch {}
    S.peers.delete(id);
  }
  async function hostOffer(peer, name) {
    const p = newPeer(peer, name);
    push({ type: 'peer', peer, name });
    wire(p, p.pc.createDataChannel('pn', { ordered: true }));
    wireU(p, p.pc.createDataChannel('pnu', { ordered: false, maxRetransmits: 0 }));
    try { await p.pc.setLocalDescription(await p.pc.createOffer()); sig({ t: 'sig.offer', to: peer, sdp: p.pc.localDescription.sdp }); }
    catch { closePeer(peer); fail('p2p_failed'); }
  }
  async function guestAnswer(sdp) {
    let p = S.peers.get('host');
    if (!p) { p = newPeer('host', 'Host'); p.pc.ondatachannel = (ev) => { if (ev.channel.label === 'pn') wire(p, ev.channel); else if (ev.channel.label === 'pnu') wireU(p, ev.channel); }; }
    try {
      await p.pc.setRemoteDescription({ type: 'offer', sdp });
      await p.pc.setLocalDescription(await p.pc.createAnswer());
      sig({ t: 'sig.answer', sdp: p.pc.localDescription.sdp });
    } catch { noLink('host'); }
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
    /* bytes from the engine's heap, as one binary message: on the unordered channel when it is open */
    sendBytes(peer, u8) {
      let n = 0;
      for (const p of S.peers.values()) {
        if (!p.open || (peer !== '*' && p.id !== peer)) continue;
        if (p.udc && p.udc.readyState === 'open' && p.udc.bufferedAmount < SEND_HIGH) { try { p.udc.send(u8); n++; } catch {} continue; }
        if (p.dc.bufferedAmount > SEND_HIGH) { closePeer(p.id); push({ type: 'left', peer: p.id }); fail('too_slow'); continue; }
        try { p.dc.send(u8); n++; } catch {}   /* no "pnu" (yet): the reliable one */
      }
      return n > 0;
    },
    /* 7i: the successors' tokens, as hashes for the Worker (the tokens themselves go to the successors) */
    async setSuccessors(tokens) {
      if (S.role !== 'host') return false;
      const hashes = await Promise.all((tokens || []).slice(0, 3).map(sha256hex));
      sig({ t: 'sig.successors', hashes }); return true;
    },
    stepDown() { if (S.role !== 'host') return false; sig({ t: 'sig.step_down' }); return true; },
    /* test: this browser vanishes as a host would (tab killed): no goodbye to anyone */
    testVanish() {
      for (const id of [...S.peers.keys()]) { const p = S.peers.get(id); try { p.pc.close(); } catch {} closePeer(id); }
      if (S.ws) { S.ws.onopen = S.ws.onmessage = S.ws.onclose = null; try { S.ws.close(4000, 'vanished'); } catch {} S.ws = null; }
      clearTimeout(S.retry); S.role = ''; S.session = ''; S.state = 'idle';
    },
    /* become the host of this session with a successor's token */
    async takeOver(token) {
      if (!S.session || !token) return false;
      /* a host already? (another successor was quicker): stay its guest, our way back goes on */
      try {
        const r = await fetch(S.api + '/api/play/' + S.session, { credentials: 'include' });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.host_present) { push({ type: 'takeover_skipped', peer: '', name: 'host_present' }); return false; }
        if (r.status === 404 || j.exists === false) { push({ type: 'takeover_skipped', peer: '', name: 'ended' }); return false; }
      } catch { push({ type: 'takeover_skipped', peer: '', name: 'unavailable' }); return false; }
      clearTimeout(S.retry); S.retry = 0; S.until = 0;
      for (const id of [...S.peers.keys()]) closePeer(id);
      if (S.ws) { S.ws.onopen = S.ws.onmessage = S.ws.onclose = null; try { S.ws.close(1000); } catch {} S.ws = null; }
      S.role = 'host'; S.succession = token; S.tries = 0; S.secret = '';
      setState('creating');
      signal(null);
      return true;
    },
    /* the host's scene to the session, kept by the Worker (7h) */
    checkpoint(text, rev) {
      if (S.role !== 'host' || !S.ws || S.ws.readyState !== 1) return false;
      /* this machine's export settings (folders, file names) are not the world's: the Worker refuses them */
      try { const d = JSON.parse(text); delete d.export; text = JSON.stringify(d); } catch { return false; }
      const of = Math.max(1, Math.ceil(text.length / CHECKPOINT_PART));
      for (let i = 0; i < of; i++) sig({ t: 'sig.checkpoint', rev, part: i, of, text: text.slice(i * CHECKPOINT_PART, (i + 1) * CHECKPOINT_PART) });
      return true;
    },
    close() {
      if (S.role === 'host') sig({ t: 'sig.close' });
      for (const id of [...S.peers.keys()]) closePeer(id);
      if (S.ws) { S.ws.onopen = S.ws.onmessage = S.ws.onclose = null; try { S.ws.close(1000); } catch {} }
      clearTimeout(S.retry); clearInterval(S.tick); S.tick = 0; S.succession = ''; S.tries = 0; if (S.title) { document.title = S.title; S.title = ''; } S.hiddenAt = 0; S.ckpt = null;
      S.ws = null; S.session = ''; S.secret = ''; S.role = ''; S.q.length = 0; S.state = 'idle'; S.echo = false; S.invite = ''; S.copied = S.refused = 0; S.until = S.retry = 0;
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
    status() { return { state: S.state, role: S.role, session: S.session, epoch: S.epoch, comebacks: S.comebacks, checkpoint: S.ckpt, unreliable_msgs: S.unreliable,
      channels: [...S.peers.values()].map(p => ({ peer: p.id, reliable: !!(p.dc && p.dc.readyState === 'open'), unordered: !!(p.udc && p.udc.readyState === 'open') })), peers: [...S.peers.values()].map(p => ({ peer: p.id, name: p.name, open: p.open })) }; },
    /* test: the network goes, without a word (the host sees the channel close; we try to come back) */
    testDrop() { if (S.role === 'guest' && S.peers.has('host')) lost('host'); },
  };
  globalThis.PnPlay = PnPlay;
  /* the host's tab hidden: no frames, so a timer keeps the room going (as often as the browser lets it) */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (S.role !== 'host' || S.hiddenAt) return;
      S.hiddenAt = Date.now();
      S.title = document.title; document.title = 'Hosting - keep this tab open';
      S.tick = setInterval(() => { try { const M = globalThis.Module; if (M && M._pn_play_background_tick) M._pn_play_background_tick(); } catch {} }, 50);
    } else if (S.hiddenAt) {
      const ms = Date.now() - S.hiddenAt;
      clearInterval(S.tick); S.tick = 0; S.hiddenAt = 0;
      if (S.title) { document.title = S.title; S.title = ''; }
      if (S.role === 'host') push({ type: 'hidden', peer: '', name: String(ms) });
    }
  });
})();
