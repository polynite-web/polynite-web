const assert = require('node:assert/strict');
const {prepareTutorialDocument,restoreTutorialCues} = require('./tutorial_scene_compat.cjs');
const input = {seq:[{op:'orbit',at:0,dur:5},{op:'text',asset:'polynite-wordmark',at:5,dur:2,branding_slot:'outro',branding_tail:2},{op:'sound',at:6.14,dur:.86,branding_slot:'outro'}]};
const supported = prepareTutorialDocument(input,true);
assert.deepEqual(supported,input); assert.notEqual(supported,input);
const legacy = prepareTutorialDocument(input,false);
assert.equal(legacy.seq.length,5);
assert.equal(legacy.seq[1].at,5); assert.equal(legacy.seq[1].branding_slot,undefined);
assert.equal(legacy.seq[2].branding_slot,'outro');
assert.deepEqual(legacy.seq[3],{op:'set',at:5,dur:.7,film_fade:1});
assert.deepEqual(legacy.seq[4],{op:'hold',at:5,dur:2});
assert.equal(input.seq.length,3); assert.equal(input.seq[1].branding_tail,2);
assert.deepEqual(prepareTutorialDocument(legacy,false),legacy);
assert.deepEqual(prepareTutorialDocument({seq:[{op:'hold',dur:5}]},false),{seq:[{op:'hold',dur:5}]});
const interactive = prepareTutorialDocument(input,false,true);
assert.equal(interactive.seq.length,1);
assert.equal(interactive.seq[0].op,'orbit');
const restored = restoreTutorialCues(interactive.seq,input,true);
assert.deepEqual(restored,input.seq);
assert.deepEqual(restoreTutorialCues(restored,input,true),restored);
assert.equal(restoreTutorialCues(interactive.seq,input,false).length,1);
console.log('PASS: old engine closing fallback, sound anchoring, immutable reference and repeated preparation');

const repeatedSounds={seq:[{op:'sound',at:1,play:{sample:'tick'}},{op:'sound',at:2,play:{sample:'tick'}}]};
assert.deepEqual(restoreTutorialCues([],repeatedSounds,false),repeatedSounds.seq);
assert.deepEqual(restoreTutorialCues(repeatedSounds.seq,repeatedSounds,false),repeatedSounds.seq);
const spatial={seq:[{op:'text',mode:'ring',exit:'spatial_type',exit_position:65,exit_direction:'left',exit_softness:.8,radius:1.2,radius_to:2.7}]};
assert.deepEqual(prepareTutorialDocument(spatial,true,true,true),spatial);
const classic=prepareTutorialDocument(spatial,true,true,false);
assert.equal(classic.seq[0].exit,'type');assert.equal(classic.seq[0].radius,1.2);
for(const key of ['exit_position','exit_direction','exit_softness','radius_to'])assert.equal(classic.seq[0][key],undefined);
assert.deepEqual(prepareTutorialDocument(classic,true,true,false),classic);
assert.equal(spatial.seq[0].exit,'spatial_type');assert.equal(spatial.seq[0].radius_to,2.7);
console.log('PASS: older viewers open spatial tutorials through an immutable classic-text fallback');

const synced={seq:[{op:'freeze',preset:'dramatic-reveal-v1',release_text:'title',release_fraction:.75,dur:1.6},{op:'text',id:'title',preset:'dramatic-title-v2',exit:'spatial_type',radius_to:3.3}]};
const previousPresetEngine=prepareTutorialDocument(synced,true,true,true,false);
assert.equal(previousPresetEngine.seq[0].dur,1.6);
assert.equal(previousPresetEngine.seq[1].exit,'spatial_type');
for(const clip of previousPresetEngine.seq)for(const key of ['preset','release_text','release_fraction'])assert.equal(clip[key],undefined);
assert.equal(synced.seq[0].release_text,'title');
console.log('PASS: earlier preset engines retain resolved cinematic timing without unsupported profile names');

const flatter={seq:[{op:'text',preset:'dramatic-title-v4',curvature:.1,mode:'ring',exit:'spatial_type',radius:.9}]};
const oldCurve=prepareTutorialDocument(flatter,true,true,true,false);
assert.equal(oldCurve.seq[0].curvature,undefined);assert.equal(oldCurve.seq[0].preset,undefined);
assert.equal(oldCurve.seq[0].radius,.9);assert.equal(flatter.seq[0].curvature,.1);
console.log('PASS: older viewers open flattened-title scenes using resolved parameters without unsupported presets');

assert.equal(oldCurve.seq[0].exit,"type");assert.ok(oldCurve.seq[0].out>=.25);

const {preserveTutorialControls}=require('./tutorial_scene_compat.cjs');
const controlsReference={initial:{scene_controls:{version:1,controls:{mass:{value:70}}}}};
const restoredControls=preserveTutorialControls({geo:{ball:{}}},controlsReference);
assert.equal(restoredControls.scene_controls.controls.mass.value,70);
restoredControls.scene_controls.controls.mass.value=90;
assert.equal(controlsReference.initial.scene_controls.controls.mass.value,70);
assert.equal(preserveTutorialControls({scene_controls:{version:1,controls:{mass:{value:100}}}},controlsReference).scene_controls.controls.mass.value,100);
console.log('PASS: legacy downloads preserve custom controls; current edited controls take precedence');
