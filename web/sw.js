/* Polynite service worker.
 *
 * It exists for ONE reason: Chrome will not fire `beforeinstallprompt` for a
 * page that has no service worker with a fetch handler, so without this file
 * the site can never be installed on Android and the Account panel's install
 * entry has nothing to offer.
 *
 * It caches NOTHING, and that is deliberate. app.js and app.wasm are already
 * cache-busted by version.txt on every deploy; a worker holding its own copy
 * of a 1.4 MB binary would pin people to a build they cannot get rid of, and
 * "clear the site data" is not an instruction anyone should need. Offline use
 * is a separate decision with its own cost, and this is not it.
 *
 * So: navigations go to the network, everything else is left alone entirely -
 * no respondWith, no interception, no measurable cost.
 *
 * A site file, like site.webmanifest and assets/: it lives at the root of
 * polynite-web and is not produced by the build. Its scope is the whole site,
 * which is why it must stay at the root - the dev build sits one folder
 * deeper and is the same app.
 */
self.addEventListener('install', function(){
   /* No cache to warm, so nothing to wait for. */
   self.skipWaiting();
});

self.addEventListener('activate', function(e){
   e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e){
   if(e.request.mode !== 'navigate') return;   /* everything else: untouched */
   e.respondWith(fetch(e.request));
});
