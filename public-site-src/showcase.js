/* Showcase: old links to a card still land on it, and a film previews silently under the pointer. */
(() => {
 const routes=document.querySelector('[data-showcase-routes]');
 if(routes&&location.hash){const route=JSON.parse(routes.dataset.showcaseRoutes)[location.hash.slice(1)];if(route)location.replace('/showcase/'+route+'/'+location.hash);}
 if(!matchMedia('(hover:hover)').matches)return;
 for(const video of document.querySelectorAll('video[data-preview]')){
  let previewing=false;
  video.addEventListener('mouseenter',()=>{if(!video.paused)return;previewing=true;video.muted=true;video.play().catch(()=>{previewing=false;});});
  video.addEventListener('mouseleave',()=>{if(previewing){previewing=false;video.pause();video.muted=false;}});
  video.addEventListener('volumechange',()=>{if(!video.muted)previewing=false;});
 }
})();
