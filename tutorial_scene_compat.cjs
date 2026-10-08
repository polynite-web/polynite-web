/* Public tutorial copies can also run on the previously published engine. */
function prepareTutorialDocument(input, tailSupported, interactive = false, spatialSupported = true, exitSyncSupported = true) {
  const document = structuredClone(input);
  if (!exitSyncSupported) for(const clip of document.seq) { if(clip.curvature !== undefined && clip.curvature < 1 && clip.exit === "spatial_type") { clip.exit="type"; clip.out=Math.max(.25,clip.opacity_out||.4); } delete clip.preset; delete clip.release_text; delete clip.release_fraction; delete clip.curvature; delete clip.camera_facing; delete clip.branding_bloom; delete clip.camera_facing; delete clip.branding_bloom; }
  if (!spatialSupported) for (const clip of document.seq) {
    if (clip.exit !== 'spatial_type') continue;
    clip.exit = 'type';
    for (const key of ['exit_position','exit_direction','exit_softness','radius_to']) delete clip[key];
  }
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
