// Progressive enhancement: cards and scene links remain usable without JavaScript.
let preview=null,timer=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const dialog=document.querySelector('#tutorial-player');
const player=dialog?.querySelector('video');
function stopPreview(){clearTimeout(timer);if(preview){preview.pause();preview.currentTime=0;preview=null;}}
function closePlayer(){player?.pause();player?.removeAttribute('src');player?.load();}
document.querySelectorAll('.tutorial-card').forEach(card=>{
 const video=card.querySelector('video');
 card.addEventListener('pointerenter',event=>{
  if(event.pointerType==='touch'||reduced||!matchMedia('(hover:hover)').matches||dialog?.open)return;
  stopPreview();timer=setTimeout(()=>{preview=video;video.muted=true;video.currentTime=0;video.play().catch(()=>{});},350);
 });
 card.addEventListener('pointerleave',stopPreview);
 card.querySelector('[data-watch]')?.addEventListener('click',()=>{
  stopPreview();dialog.querySelector('h2').textContent=card.querySelector('h3').textContent;
  dialog.querySelector('[data-scene]').href=card.querySelector('[data-scene]').href;
  player.src=card.dataset.fullVideo;player.poster=video.poster;player.muted=false;
  dialog.showModal();player.play().catch(()=>{});
 });
});
dialog?.querySelector('[data-close]')?.addEventListener('click',()=>dialog.close());
dialog?.addEventListener('close',closePlayer);
dialog?.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
 const target=document.getElementById(button.dataset.copy);
 try{await navigator.clipboard.writeText(target.textContent.trim());button.textContent='Copied!';setTimeout(()=>button.textContent='Copy prompt',1800);}
 catch{const selection=getSelection(),range=document.createRange();range.selectNodeContents(target);selection.removeAllRanges();selection.addRange(range);button.textContent='Select and copy the prompt';}
}));
const filters=[...document.querySelectorAll('[data-filter]')];
filters.forEach(button=>button.addEventListener('click',()=>{
 stopPreview();filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 let count=0;document.querySelectorAll('.tutorial-card').forEach(card=>{card.hidden=button.dataset.filter!=='all'&&!card.dataset.tags.split(' ').includes(button.dataset.filter);if(!card.hidden)count++;});
 document.querySelector('#tutorial-count').textContent=count+(count===1?' tutorial':' tutorials');
}));
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPreview();player?.pause();}});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting&&preview&&e.target.contains(preview))stopPreview();}));
document.querySelectorAll('.tutorial-card').forEach(card=>observer.observe(card));
