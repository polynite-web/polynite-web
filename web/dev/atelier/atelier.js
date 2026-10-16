'use strict';
const cards = [...document.querySelectorAll('article')];
const filter = document.querySelector('#filter');
const collection = document.querySelector('#collection');
const storageKey = 'polynite-atelier-favorites-v1';
let favorites = new Set();
try { favorites = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch {}
const url = new URL(location.href);
if ([...collection.options].some(o => o.value === url.searchParams.get('collection'))) collection.value = url.searchParams.get('collection');
const introTitle = document.querySelector('h1').innerHTML;
const introLead = document.querySelector('.lead').textContent;
function refresh() {
  let count = 0;
  for (const card of cards) {
    const chosen = collection.value === 'all' || (collection.value === 'favorites' ? favorites.has(card.id) : card.dataset.collection === collection.value);
    card.hidden = !chosen || (filter.value !== 'all' && card.dataset.format !== filter.value);
    const button = card.querySelector('.favorite');
    button.setAttribute('aria-pressed', String(favorites.has(card.id)));
    button.textContent = favorites.has(card.id) ? 'Dans mes favoris ♥' : 'Garder dans mes favoris';
    if (card.hidden) card.querySelector('video').pause();
    else count++;
  }
  document.querySelector('h1').innerHTML = collection.value === 'atmospheres' ? 'Choisir une ambiance.<br><em>Imaginer la suivante.</em>' : introTitle;
  document.querySelector('.lead').textContent = collection.value === 'atmospheres' ? 'Constructions, environnements et essais d’adaptation : regarde les boucles, compare leurs réglages et garde tes préférées. Chaque fiche indique sa durée et conserve sa scène originale.' : introLead;
  document.querySelector('#count').textContent = `${count} rendu${count > 1 ? 's' : ''}`;
  document.querySelector('.empty').hidden = count > 0;
}
filter.addEventListener('change', refresh);
collection.addEventListener('change', () => {
  const next = new URL(location.href);
  if (collection.value === 'all') next.searchParams.delete('collection');
  else next.searchParams.set('collection', collection.value);
  history.replaceState(null, '', next);
  refresh();
});
for (const card of cards) card.querySelector('.favorite').addEventListener('click', () => {
  if (favorites.has(card.id)) favorites.delete(card.id); else favorites.add(card.id);
  try { localStorage.setItem(storageKey, JSON.stringify([...favorites])); } catch {}
  refresh();
});
for (const video of document.querySelectorAll('video')) {
  video.addEventListener('play', () => {
    for (const other of document.querySelectorAll('video')) if (other !== video) other.pause();
  });
}
refresh();
