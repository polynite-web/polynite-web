/* Open only a published Atelier scene, in a separate normal Polynite viewer. */
(async function () {
  'use strict';
  const frame = document.querySelector('#viewer');
  const status = document.querySelector('#status');
  const play = document.querySelector('#play');
  const id = new URL(location.href).searchParams.get('scene');
  const fallback = document.querySelector('#fallback');
  let engine, timer, disposed = false;
  const call = (command, fields = {}) => {
    let result;
    try { result = engine.call('scene.cinematic', {request: {command, ...fields}}); }
    catch (error) { error.operation = command; throw error; }
    if (result?.error) throw new Error(result.error.message || 'Erreur du viewer');
    return result;
  };
  const fail = error => {
    status.textContent = 'Le viewer n’a pas pu ouvrir la scène' + (error.operation ? ' (' + error.operation + ')' : '') + ' : ' + error.message + (fallback.src ? ' La vidéo originale reste disponible ci-dessous.' : '');
    frame.hidden = true;
    play.disabled = true;
    fallback.hidden = !fallback.src;
  };
  window.addEventListener('pagehide', () => { disposed = true; clearTimeout(timer); });
  try {
    const response = await fetch('manifest.json');
    if (!response.ok) throw new Error('catalogue indisponible');
    const entry = (await response.json()).entries.find(item => item.id === id);
    if (!entry || !/^media\/[a-zA-Z0-9_-]+\.scene$/.test(entry.scene)) throw new Error('rendu introuvable');
    document.querySelector('#title').textContent = entry.title;
    document.title = entry.title + ' · Polynite';
    document.querySelector('#back').href = './#' + encodeURIComponent(entry.id);
    const download = document.querySelector('#download');
    download.href = entry.scene; download.hidden = false;
    const video = document.querySelector('#video');
    if (/^media\/[a-zA-Z0-9_-]+\.mp4$/.test(entry.video)) {
      video.href = entry.video; video.hidden = false;
      fallback.src = entry.video; fallback.poster = entry.poster;
    }
    const sceneResponse = await fetch(entry.scene);
    if (!sceneResponse.ok) throw new Error('fichier de scène indisponible');
    const documentCopy = await sceneResponse.json();
    if (disposed) return;
    // The published release candidate exposes the normal scene APIs/controls.
    // Loading happens once; later interactions never reapply this document.
    frame.src = '/rel/';
    status.textContent = 'Chargement du moteur Polynite…';
    function ready() {
      if (disposed) return;
      try {
        engine = frame.contentWindow.polynite;
        if (!engine?.call) { timer = setTimeout(ready, 300); return; }
        if (call('status').export.active) throw new Error('viewer occupé par un export');
        frame.contentWindow.addEventListener('polynite:engine-failed', event => fail(new Error(event.detail?.message || 'moteur arrêté')));
        call('load_document', {document: documentCopy, start_paused: true});
        play.disabled = false;
        frame.hidden = false;
        frame.classList.remove('pending');
        status.textContent = 'Scène prête. Explore-la ou lance la séquence avec le son.';
      } catch (error) { fail(error); }
    }
    ready();
    play.addEventListener('click', async () => {
      play.disabled = true;
      try {
        if (frame.contentWindow.vmeshAudioGesture) await frame.contentWindow.vmeshAudioGesture();
        const current = call('status');
        if (current.export.active) throw new Error('viewer occupé par un export');
        if (current.playing && !current.paused) {
          call('pause'); play.textContent = 'Continuer';
        } else {
          call(current.playing ? 'resume' : 'play'); play.textContent = 'Pause';
        }
        status.textContent = 'Tu peux ajuster la scène dans les panneaux Polynite.';
      } catch (error) { fail(error); }
      finally { play.disabled = false; }
    });
  } catch (error) { fail(error); }
})();
