document.addEventListener('submit', event => {
  const button=event.target.querySelector('button[type="submit"]');
  if(button && !event.defaultPrevented){
    button.disabled=true;
    setTimeout(()=>{button.disabled=false},5000);
  }
});
addEventListener('pageshow',()=>document.querySelectorAll('button:disabled').forEach(b=>{b.disabled=false}));

document.addEventListener('click',event=>{
  const link=event.target.closest('[data-play]');
  if(!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)return;
  const host=link.closest('[data-video]');
  if(!/^[a-zA-Z0-9_-]{11}$/.test(host.dataset.video))return;
  event.preventDefault();
  const frame=document.createElement('iframe');
  frame.src='https://www.youtube-nocookie.com/embed/'+host.dataset.video+'?autoplay=1&rel=0';
  frame.title='Media reference from the original publisher';
  frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
  host.replaceChildren(frame);
});
