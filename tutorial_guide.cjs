const {esc}=require('./site_metadata.cjs');
const number=value=>Number(value.toPrecision(5)).toString();
function prepareSettingsGuide(groups,document){
 if(!groups)return undefined;
 const controls=document.initial?.scene_controls?.controls;if(!controls)throw Error('Settings guide requires scene controls');
 return groups.map(group=>({title:group.title,items:group.items.map(item=>{
  const control=controls[item.id];if(!control)throw Error('Unknown tutorial control '+item.id);
  const range=control.type==='toggle'?'On / Off':control.type==='select'?control.options.map(option=>option.label).join(' / '):`${number(control.min)}–${number(control.max)}${control.unit?' '+control.unit:''}`;
  return {...item,range,type:control.type};
 })}));
}
function renderTutorialGuide(item){
 const settings=item.settings_groups?`<details class="guide settings-guide"><summary>Custom settings · ${item.settings_groups.reduce((count,group)=>count+group.items.length,0)} controls</summary><p class="tutorial-hint">These settings belong to this scene and are saved with it.</p>${item.settings_groups.map(group=>`<h4>${esc(group.title)}</h4><dl>${group.items.map(control=>`<dt><strong>${esc(control.label)}</strong> <small>${esc(control.range)}</small></dt><dd>${esc(control.hint)}${control.updated_viewer?' <em>Updated viewer required.</em>':''}</dd>`).join('')}</dl>`).join('')}</details>`:'';
 const experiments=item.experiments?`<details class="guide tutorial-experiments"><summary>Try ${item.experiments.length} guided experiments</summary><ol>${item.experiments.map(experiment=>`<li><strong>${esc(experiment.title)}</strong><br>${esc(experiment.text)}</li>`).join('')}</ol></details>`:'';
 return settings+experiments+(item.viewer_note?`<p class="tutorial-hint viewer-note">${esc(item.viewer_note)}</p>`:'');
}
module.exports={prepareSettingsGuide,renderTutorialGuide};
