'use strict';
const intakeEndpoint=new URL('api/intake',document.currentScript.src);
const form=document.querySelector('#request'),srt=document.querySelector('#srt'),info=document.querySelector('#packet-status'),notice=document.querySelector('#receipt');
const submit=document.querySelector('#submit'),download=document.querySelector('#download');
const query=new URLSearchParams(location.search);
const tier=query.get('service');if(['studio','catalog','pilot'].includes(tier))form.elements.service.value=tier;
const source=(query.get('src')||'website').replace(/[^a-z0-9-]/gi,'').slice(0,45);
let packet=null,generation=0,requestId=crypto.randomUUID();
form.oninput=()=>{requestId=crypto.randomUUID();notice.textContent='';};
srt.onchange=async()=>{
  const revision=++generation;packet=null;download.hidden=true;info.textContent='';const f=srt.files[0];if(!f){submit.disabled=false;return;}
  submit.disabled=true;
  try{if(!/\.srt$/i.test(f.name))throw Error('Choose an English SRT file.');const p=await CaptionDeskPacket.fromFile(f);if(revision!==generation)return;
    packet=p;info.textContent=p.cues+' cue blocks and '+p.findings.length+' technical findings. Only the diagnostics will be sent.';download.hidden=false;
  }catch(e){if(revision!==generation)return;info.textContent=e.message;srt.value='';}finally{if(revision===generation)submit.disabled=false;}
};
download.onclick=()=>{if(!packet)return;const url=URL.createObjectURL(new Blob([JSON.stringify(packet)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='caption-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
form.onsubmit=async e=>{
  e.preventDefault();notice.textContent='';const fields=Object.fromEntries(new FormData(form));if(fields.website)return;
  if(packet&&(!fields.title.trim()||!fields.version.trim())){notice.textContent='Add a title alias and revision label for these diagnostics.';return;}
  submit.disabled=true;
  try{
    const body=JSON.stringify({...fields,source,requestId,packet});
    if(new TextEncoder().encode(body).length>3*1024*1024)throw Error('This diagnostics packet is too large for the web form. Download it and email it to the desk.');
    const r=await fetch(intakeEndpoint,{method:'POST',headers:{'content-type':'application/json'},body});const d=await r.json();
    if(!r.ok||!d.receipt)throw Error(d.message||'The form could not confirm receipt. Retry or use the email intake below.');
    notice.textContent='Received. Your reference is '+d.receipt+'. We aim to reply within two U.S. business days. Keep this reference for a recheck.';form.reset();packet=null;download.hidden=true;info.textContent='';requestId=crypto.randomUUID();
  }catch(err){notice.textContent=err instanceof SyntaxError?'The online intake is unavailable. Please use the email intake below.':err.message;}finally{submit.disabled=false;}
};
