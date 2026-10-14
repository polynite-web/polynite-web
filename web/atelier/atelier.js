'use strict';
const cards = [...document.querySelectorAll('article')];
const filter = document.querySelector('#filter');
filter.addEventListener('change', () => {
  let count = 0;
  for (const card of cards) {
    card.hidden = filter.value !== 'all' && card.dataset.format !== filter.value;
    if (card.hidden) card.querySelector('video').pause();
    else count++;
  }
  document.querySelector('#count').textContent = `${count} rendu${count > 1 ? 's' : ''}`;
  document.querySelector('.empty').hidden = count > 0;
});
for (const video of document.querySelectorAll('video')) {
  video.addEventListener('play', () => {
    for (const other of document.querySelectorAll('video')) if (other !== video) other.pause();
  });
}
