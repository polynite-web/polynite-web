/* Public tutorial copies can also run on the previously published engine. */
function prepareTutorialDocument(input, tailSupported, interactive = false) {
  const document = structuredClone(input);
  if (interactive) document.seq = document.seq.filter(clip => clip.branding_slot !== 'outro');
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
function restoreTutorialCues(seq, reference, includeOutro) {
  const copy = structuredClone(seq);
  for (const cue of reference.seq.filter(clip => (clip.op === 'sound' || clip.branding_slot) && (includeOutro || clip.branding_slot !== 'outro'))) {
    if (!copy.some(clip => clip.op === cue.op && clip.branding_slot === cue.branding_slot && (cue.branding_slot || ((clip.at || 0) === (cue.at || 0) && JSON.stringify(clip.play) === JSON.stringify(cue.play))))) copy.push(structuredClone(cue));
  }
  return copy;
}
module.exports = {prepareTutorialDocument, restoreTutorialCues};
