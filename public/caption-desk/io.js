'use strict';
function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value!==undefined) node.textContent=value;
  if (className) node.className=className;
  return node;
}
function connectFileInput(receive,notify) {
  const box=document.getElementById('drop'),input=document.getElementById('file');
  let request=0;
  async function read(file) {
    const current=++request;
    if (!file) return;
    try {
      if (!/\.srt$/i.test(file.name)) throw Error('Choose a file with the .srt extension.');
      if (file.size>2*1024*1024) throw Error('Choose an SRT smaller than 2 MB.');
      let text;
      try { text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()); }
      catch { throw Error('Save the SRT as UTF-8 and try again.'); }
      if (!text.trim() || text.includes('\0')) throw Error('Choose a nonempty UTF-8 caption file.');
      if (current===request) receive(text,file.name);
    } catch(e) { if (current===request) notify(e.message); }
  }
  input.addEventListener('change',()=>{const f=input.files[0];input.value='';read(f);});
  box.addEventListener('dragover',e=>{e.preventDefault();box.classList.add('drag');});
  box.addEventListener('dragleave',()=>box.classList.remove('drag'));
  box.addEventListener('drop',e=>{e.preventDefault();box.classList.remove('drag');read(e.dataTransfer.files[0]);});
}
