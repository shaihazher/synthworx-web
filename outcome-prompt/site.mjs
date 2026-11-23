import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {openStore,issue} from './store.mjs';
import {generate} from './rewrite.mjs';
import {billing} from './billing.mjs';

const mount='/outcome-prompt/';
const sources=new Set(['synthworx','postlaunchkit','promoteindex','search','directory','example','direct','referral']);
const assets=new Map(Object.entries({
  '':'index.html','examples':'examples.html','privacy':'privacy.html','terms':'terms.html','support':'support.html','receipt':'receipt.html',
  'app.js':'app.js','style.css':'style.css','logo.png':'logo.png','serif.woff2':'serif.woff2','sans.woff2':'sans.woff2',
  'FONT-LICENSES.txt':'FONT-LICENSES.txt','sitemap.xml':'sitemap.xml','outcome-prompt.zip':'outcome-prompt.zip'
}));
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',xml:'application/xml',png:'image/png',woff2:'font/woff2',zip:'application/zip',txt:'text/plain; charset=utf-8'};
async function jsonBody(req) {
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) throw issue(415,'Send JSON from the Outcome Prompt editor.');
  const parts=[];let size=0;
  for await(const part of req){size+=part.length;if(size>35000)throw issue(413,'Please shorten your request.');parts.push(part);}
  try{const data=JSON.parse(Buffer.concat(parts));if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return data;}catch{throw issue(400,'The request could not be read.');}
}
const asText=(v,max)=>typeof v==='string' && v.trim().length<=max ? v.trim():'';
export function createOutcomeSite(options={}) {
  const env=process.env, origin=options.origin||'https://synthworx.com';
  const secret=options.secret||env.OP_SECRET, modelKey=options.modelKey||env.OP_MODEL_KEY;
  const dir=options.data||join(env.RAILWAY_VOLUME_MOUNT_PATH||'/data','outcome-prompt');
  const staticDir=options.assets||resolve('dist/outcome-prompt');
  const qaToken=options.qaToken||env.OP_QA_KEY;
  const model=options.model||((source,prev)=>generate(source,prev,modelKey));
  const pay=options.billing||billing({base:'https://live.dodopayments.com',key:env.OP_DODO_KEY,product:env.OP_PRODUCT,entitlement:env.OP_ENTITLEMENT,origin});
  let state, inFlight=0;
  const limits=new Map();
  function limit(key,max) {
    const at=Date.now();
    const current=limits.get(key);
    if(current && current.until>at){if(current.count>=max)throw issue(429,'Please try again in a minute.');current.count++;return;}
    if(limits.size>1500) for(const [k,v] of limits)if(v.until<=at) limits.delete(k);
    limits.set(key,{until:at+60000,count:1});
  }
  return async function route(req,res) {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
    function json(status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
    function redirect(status,location){res.writeHead(status,{Location:location});res.end();}
    try {
      const u=new URL(req.url,origin), part=u.pathname.slice(mount.length);
      if(u.pathname===mount.slice(0,-1))return redirect(308,mount+u.search);
      if(!u.pathname.startsWith(mount))throw issue(404,'Page unavailable.');
      if(!part.startsWith('api/')) {
        if(!['GET','HEAD'].includes(req.method))throw issue(405,'Use GET for this page.');
        if(part==='receipt' && u.search)return redirect(303,mount+'receipt');
        let file=assets.get(part);
        if(/^[a-f0-9]{32}\.txt$/.test(part))file=part;
        if(!file)throw issue(404,'Page unavailable.');
        let body;try{body=await readFile(join(staticDir,file));}catch(e){if(e.code==='ENOENT')throw issue(404,'Page unavailable.');throw e;}
        if(file.endsWith('.zip'))res.setHeader('Content-Disposition','attachment; filename="outcome-prompt.zip"');
        res.writeHead(200,{'Content-Type':mime[file.split('.').pop()],'Content-Length':body.length,'Cache-Control':'public, max-age=0, must-revalidate'});
        res.end(req.method==='HEAD'?undefined:body);return;
      }
      if(req.method!=='POST') throw issue(405,'Use the Outcome Prompt editor.');
      if(req.headers.origin!==origin) throw issue(403,'Use the editor on Synthworx.');
      if(!secret) throw issue(503,'The editor is temporarily unavailable.');
      state ||=openStore(dir,secret);
      const body=await jsonBody(req);
      const ip=String(req.headers['x-real-ip']||String(req.headers['x-forwarded-for']||'').split(',').at(-1)?.trim()||req.socket.remoteAddress||'unknown');
      const network=state.hash('network:'+new Date().toISOString().slice(0,10),ip);
      limit(network+'all',180);
      const match=(req.headers.cookie||'').match(/(?:^|;\s*)op_session=([a-f0-9]{64})(?:;|$)/);
      let s=match && state.access(state.hash('session',match[1]));
      if(part==='api/state'){
        if(!s)limit(network+'session',25);
        const qa=!!qaToken && req.headers['x-outcome-qa']===qaToken;
        const init=state.ensure(match?.[1],sources.has(body.source)?body.source:'direct',qa);
        if(init.token)res.setHeader('Set-Cookie','op_session='+init.token+'; Path='+mount+'; HttpOnly; SameSite=Lax; Max-Age=31536000'+(origin.startsWith('https:')?'; Secure':''));
        return json(200,state.balance(init.session));
      }
      if(!s)throw issue(401,'Allow the site cookie, then reload the editor.');
      if(part==='api/checkout'){
        limit(network+'checkout',12);
        const url=await pay.checkout(s.qa?'qa':s.source);
        state.event(s.id,'checkout');return json(200,{url});
      }
      if(part==='api/pack'){
        limit(network+'keys',8);
        const key=asText(body.key,160);
        if(key.length<12)throw issue(400,'Enter the pack key from your Dodo email.');
        const pack=await pay.redeem(key);
        if(!pack)throw issue(403,'That key could not be matched to an active Outcome Prompt pack.');
        state.exec('INSERT OR IGNORE INTO packs(id,customer) VALUES(?,?)',pack.id,pack.customer);
        state.exec('UPDATE sessions SET pack=? WHERE id=?',pack.id,s.id);
        state.event(s.id,'redeem');return json(200,state.balance(state.access(s.id)));
      }
      const id=asText(body.id,36);
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw issue(400,'Missing request identifier.');
      if(part==='api/feedback'){
        if(!['closer','missed','copy'].includes(body.value))throw issue(400,'Choose one of the options.');
        const update=body.value==='copy' ? state.exec("UPDATE runs SET copied=1 WHERE sid=? AND rid=? AND status='ready'",s.id,id)
          :state.exec("UPDATE runs SET rating=? WHERE sid=? AND rid=? AND status='ready'",body.value,s.id,id);
        if(!update.changes)throw issue(404,'Rewrite unavailable.');
        return json(200,{ok:true});
      }
      if(part!=='api/rewrite')throw issue(404,'Page unavailable.');
      const source=asText(body.source,4000), previous=asText(body.previous||'',4500);
      if(source.length<5 || (body.previous&&!previous))throw issue(400,'Use between 5 and 4,000 characters for your request.');
      if(inFlight>=16)throw issue(503,'The editor is busy. Please retry shortly.');
      limit(network+'rewrite',24);
      if(s.pack && !await pay.active(state.query('SELECT * FROM packs WHERE id=?',s.pack)))throw issue(403,'Your pack is inactive. Enter a current pack key.');
      const cached=state.reserve(s,id,JSON.stringify([source,previous]),network);
      if(cached)return json(200,{...cached,...state.balance(s)});
      inFlight++;
      let result;
      try {
        result=await model(source,previous);
        state.complete(s.id,id,result);
      } catch(e) {
        state.exec("UPDATE runs SET status='error' WHERE sid=? AND rid=?",s.id,id);
        throw e;
      } finally {inFlight--;}
      return json(200,{kind:result.kind,text:result.text,...state.balance(s)});
    } catch(e){
      if(!e.status)console.error('Outcome Prompt service error:',e.name, String(e.message).match(/HTTP \d{3}/)?.[0]||'request failed');
      if(!res.headersSent)json(e.status||503,{message:e.status?e.message:'The service is temporarily unavailable. Please retry. Your rewrite balance is preserved.'});
    }
  };
}
