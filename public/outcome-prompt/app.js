export {};
const $=id=>document.getElementById(id);
async function post(route,data){
  const response=await fetch('/outcome-prompt/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  let body;try{body=await response.json();}catch{throw Error('The service is unavailable. Please retry.');}
  if(!response.ok){const err=Error(body.message||'Please try again.');err.status=response.status;throw err;}return body;
}
const source=$('source'), query=new URLSearchParams(location.search);
const ref=(()=>{try{return new URL(document.referrer).hostname;}catch{return '';}})();
const channel=query.get('src')||query.get('utm_source')||(/(^|\.)(google|bing|duckduckgo)\./i.test(ref)?'search':ref==='promoteindex.com'?'promoteindex':ref==='postlaunchkit.com'?'postlaunchkit':ref&&ref!==location.hostname?'referral':'direct');
function quota(v){$('quota').textContent=v.remaining+' '+(v.paid?'pack':'free')+' rewrite'+(v.remaining===1?'':'s')+' left';}
let ready,previous='',record=null,pending=null,busy=false;
function init(){
  ready=post('state',{source:channel}).then(quota).catch(err=>{ready=null;$('status').textContent=err.message;throw err;});
  return ready;
}
const boot=()=>ready||init();void boot().catch(()=>{});
const drafts=JSON.parse($('example-drafts').textContent);
const specimens=Object.values(drafts);
let example=0;
function count(){ $('counter').textContent=source.value.length.toLocaleString()+' / 4,000';}
function normal(){previous='';$('source-label').textContent='Your original request';$('go').textContent='Rewrite my request';}
const requestedExample=query.get('example');
if(Object.hasOwn(drafts,requestedExample)){source.value=drafts[requestedExample];count();}
$('example').onclick=()=>{normal();source.value=specimens[example++%specimens.length];count();source.focus();pending=null;};
source.oninput=()=>{count();pending=null;};
$('rewrite').onsubmit=async e=>{
  e.preventDefault();if(busy)return;busy=true;
  const input=source.value.trim();
  if(!pending||pending.source!==input||pending.previous!==previous)pending={id:crypto.randomUUID(),source:input,previous};
  $('go').disabled=true;$('example').disabled=true;source.readOnly=true;$('status').textContent='Rewriting…';
  try{
    await boot();const v=await post('rewrite',pending);quota(v);
    record={id:pending.id,text:v.text,kind:v.kind,source:input,previous};pending=null;
    $('answer').textContent=v.text;$('result').hidden=false;
    $('result-title').textContent=v.kind==='ready'?'Your outcome prompt':v.kind==='clarify'?'One detail to clarify':'A different request is needed';
    $('copy').hidden=v.kind!=='ready';$('revise').hidden=v.kind==='declined';$('revise').textContent=v.kind==='clarify'?'Add detail':'Revise';
    $('rating').hidden=v.kind!=='ready';document.querySelectorAll('[data-vote]').forEach(b=>b.removeAttribute('aria-pressed'));
    $('status').textContent=v.kind==='ready'?'':'Your balance is unchanged.';$('answer').focus();
  }catch(err){$('status').textContent=err.message;if(err.status===402)$('pack').scrollIntoView({block:'center'});}
  finally{busy=false;$('go').disabled=false;source.readOnly=false;$('example').disabled=false;}
};
$('copy').onclick=async()=>{if(!record)return;try{await navigator.clipboard.writeText(record.text);$('status').textContent='Prompt copied.';void post('feedback',{id:record.id,value:'copy'}).catch(()=>{});}catch{$('status').textContent='Select the prompt text and copy it.';}};
$('revise').onclick=()=>{if(!record||busy)return;previous=record.kind==='clarify'?[record.previous,record.source,record.text].filter(Boolean).join('\n').slice(-4500):record.text;source.value='';$('source-label').textContent=record.kind==='clarify'?'Add the missing detail':'What would you like to change?';$('go').textContent='Update my prompt';count();pending=null;source.focus();};
$('fresh').onclick=()=>{if(busy)return;normal();record=null;pending=null;$('result').hidden=true;source.value='';$('status').textContent='';count();source.focus();};
document.querySelectorAll('[data-vote]').forEach(b=>b.onclick=async()=>{if(!record)return;try{await post('feedback',{id:record.id,value:b.dataset.vote});document.querySelectorAll('[data-vote]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));$('status').textContent='Thanks for the feedback.';}catch(e){$('status').textContent=e.message;}});
$('buy').onclick=async()=>{const b=$('buy');b.disabled=true;$('billing-status').textContent='Opening checkout…';try{await boot();const r=await post('checkout',{});location.assign(r.url);}catch(e){$('billing-status').textContent=e.message;b.disabled=false;}};
$('redeem').onsubmit=async e=>{e.preventDefault();const button=$('redeem').querySelector('button');button.disabled=true;try{await boot();const r=await post('pack',{key:$('key').value.trim()});quota(r);$('key').value='';$('billing-status').textContent='Pack ready. '+r.remaining+' rewrites available.';$('editor').scrollIntoView({block:'center'});source.focus();}catch(err){$('billing-status').textContent=err.message;}finally{button.disabled=false;}};
if(query.get('unlock')==='1')$('unlock').open=true;
window.addEventListener('pageshow',e=>{if(e.persisted){$('buy').disabled=false;$('billing-status').textContent='';void init().catch(()=>{});}});
