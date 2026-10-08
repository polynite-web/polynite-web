/* Public tutorial copies can also run on the previously published engine. */
function prepareTutorialDocument(input, tailSupported) {
  const document = structuredClone(input);
  if (tailSupported) return document;
  const tails = document.seq.filter(clip => clip.branding_slot === 'outro' && clip.branding_tail > 0);
  for (const clip of tails) {
    const start = clip.at, duration = clip.dur;
    delete clip.branding_slot;
    delete clip.branding_tail;
    document.seq.push({op:'set',at:start,dur:Math.min(.7,duration),film_fade:1});
    document.seq.push({op:'hold',at:start,dur:duration});
  }
  return document;
}
module.exports = {prepareTutorialDocument};
