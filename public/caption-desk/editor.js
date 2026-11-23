'use strict';
(async()=>{
  const message=document.getElementById('message');
  let access=new URLSearchParams(location.hash.slice(1)).get('access');
  if(location.hash) history.replaceState(null,'',location.pathname);
  try { if(!access)access=sessionStorage.getItem('captionDeskAccessV1'); } catch {}
  if(!access)return;
  if(!/^[A-Za-z0-9_-]{43}$/.test(access)){message.textContent='This link is incomplete. Reopen the full editor link in your purchase email.';return;}
  try {
    message.textContent='Opening your private workbench…';
    const raw=Uint8Array.from(atob(access.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
    const response=await fetch('workbench-v1.bin',{credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw Error();
    const data=new Uint8Array(await response.arrayBuffer());
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:data.subarray(0,12)},key,data.subarray(12));
    const frame=document.getElementById('tool');
    frame.srcdoc=new TextDecoder().decode(plain);
    try{sessionStorage.setItem('captionDeskAccessV1',access);}catch{}
    document.getElementById('gate').hidden=true;
    frame.hidden=false;document.body.classList.add('ready');
  } catch {
    message.textContent='The workbench could not open. Check your connection and reopen the original editor link from your purchase. For help email hello@synthworx.com.';
  }
})();
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#access=')) location.reload();});
