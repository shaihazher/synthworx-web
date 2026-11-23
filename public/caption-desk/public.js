'use strict';
const stationSample=new URL('station-sample.srt',document.currentScript.src);
const result=document.getElementById('result'),statusBox=document.getElementById('status');
function showReport(text,name) {
  const {cues,findings}=CaptionQC.scan(text);
  result.replaceChildren();
  result.hidden=false;
  statusBox.textContent=name+' · '+cues.length+' cue blocks · '+findings.length+' technical findings';
  if (!findings.length) {
    result.append(element('p','No issues found in the automated checks. Play the captioned cut to verify dialogue, sound descriptions, and sync.'));
    return;
  }
  const ul=element('ul');
  for (const f of findings.slice(0,3)) {
    const li=element('li');
    li.append(element('strong',f.rule+' · block '+f.index),element('span',f.stamp.length<64 && f.stamp.includes('-->')?f.stamp:'Source line '+f.line,'small'),element('span',f.detail));
    ul.append(li);
  }
  result.append(element('h3','First '+Math.min(3,findings.length)+' findings'),ul);
  const a=element('a','See the full repair workbench');a.href='#workbench';result.append(a);
}
function showError(msg){statusBox.textContent=msg;result.hidden=true;}
connectFileInput(showReport,showError);
document.getElementById('sample').onclick=async()=>{
  try {const res=await fetch(stationSample);if(!res.ok)throw Error();showReport(await res.text(),'Station sample');}
  catch{showError('The sample could not load. Please retry or choose your SRT.');}
};

const durationExample=document.getElementById('duration-example');
if (durationExample) {
  const result=durationExample.querySelector('[role="status"]');
  const buttons=[...durationExample.querySelectorAll('button[data-end]')];
  function check(button) {
    const end=button.dataset.end;
    const source=['4','00:00:09,000 --> 00:00:09,'+end,'Ready?'].join('\n');
    const {findings}=CaptionQC.scan(source);
    const duration=Number(end)/1000;
    durationExample.querySelector('output').textContent='9.00 s – '+(9+duration).toFixed(2)+' s';
    result.textContent=findings.length
      ? 'Flagged. “Ready?” is on screen for '+duration.toFixed(2)+' seconds. Filmhub requires at least 0.60 seconds.'
      : 'Timing check passed. The editor kept “Ready?” on screen for '+duration.toFixed(2)+' seconds.';
    for (const item of buttons) item.setAttribute('aria-pressed',String(item===button));
  }
  for(const button of buttons)button.addEventListener('click',()=>check(button));
  check(buttons[0]);
}
