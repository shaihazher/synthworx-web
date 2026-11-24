import {DatabaseSync} from 'node:sqlite';
import {createHash,createHmac,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync} from 'node:fs';
import {mkdir,writeFile,rename,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,origin,desks,focuses,planById} from './catalog.mjs';
import {page,e,home,pricing,report,methodology,terms} from './views.mjs';
import {makeBilling} from './billing.mjs';
import {sendReaderCode} from './mail.mjs';
const productIds=JSON.parse(readFileSync(new URL('./products.json',import.meta.url),'utf8'));
const slugSet=new Set(Object.values(focuses).flatMap(Object.keys));
const deskSet=new Set(Object.keys(desks));
const hash=v=>createHash('sha256').update(v).digest('hex');
const err=(status,message)=>Object.assign(Error(message),{status});
const validURL=u=>{try{const x=new URL(u);return x.protocol==='https:'&&!x.username&&!x.password}catch{return false}};
export function validateEdition(v){
  const dates=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s));
  if(!dates(v?.published)||!/^[a-f0-9]{64}$/.test(v.ledgerHash||'')||!v.revision||v.reports?.length!==slugSet.size||v.momentum?.rows?.length!==slugSet.size)throw err(422,'Edition is incomplete.');
  for(const [desk,focus] of Object.entries(focuses))for(const slug of Object.keys(focus)){
    const r=v.reports.find(x=>x.slug===slug&&x.industry===desk),row=v.momentum.rows.find(x=>x.slug===slug&&x.industry===desk);
    if(!r || !row || !validURL(row.sourceUrl) || !dates(r.reviewed) || !['headline','teaser','call','horizon','confidence','move','audience'].every(k=>typeof r[k]==='string'&&r[k].trim()) ||
       !['bet','signals','test'].every(k=>r.out_of_the_blue?.[k]?.trim())||!r.media?.length||r.evidence?.length<2||![...r.evidence,...r.media].every(x=>x.label&&validURL(x.url)&&x.note))throw err(422,'Check sources and report fields for '+slug+'.');
    for(const key of ['month','quarter']){
      const a=row[key],w=v.momentum.windows[key];
      if(!a||![a.current,a.previous].every(Number.isFinite)||!(a.changePct===null||Number.isFinite(a.changePct))||!['start','end','priorStart','priorEnd'].every(k=>dates(w[k])))throw err(422,'Check the observations for '+slug+'.');
    }
    if(slug==='romcom'&&!['premise','dynamic','dialogue','visual'].every(k=>r.creative?.[k]?.trim()))throw err(422,'Complete the romantic comedy development brief.');
  }
  if(v.overviews!==undefined){
    if(v.overviews.length!==deskSet.size)throw err(422,'Complete all four industry briefs.');
    for(const id of deskSet){
      const r=v.overviews.find(row=>row.slug===id&&row.industry===id);
      if(!r||!dates(r.reviewed)||!['headline','teaser','call','horizon','confidence','audience','move'].every(k=>r[k]?.trim())||
        !['bet','signals','test'].every(k=>r.out_of_the_blue?.[k]?.trim())||r.evidence?.length<2||!r.media?.length||
        ![...r.evidence,...r.media].every(x=>x.label&&validURL(x.url)&&x.note))throw err(422,'Check the '+id+' industry brief.');
    }
  }
  return v;
}
const newToken=()=>randomBytes(32).toString('base64url');
const names={session:'__Secure-cr-reader',challenge:'__Secure-cr-request'};
function cookies(request){return Object.fromEntries((request.headers.cookie||'').split(';').map(s=>s.trim().split('=')));}
function readBody(req,limit){
  return new Promise((resolve,reject)=>{let size=0;const chunks=[];req.on('data',b=>{size+=b.length;if(size<=limit)chunks.push(b);else if(chunks.length){chunks.length=0;reject(err(413,'That submission is too large.'));}else reject(err(413,'That submission is too large.'))});req.on('end',()=>{if(size<=limit)resolve(Buffer.concat(chunks).toString('utf8'))});req.on('error',reject);});
}
function accountPage(inner){return page('Reader access',`<div class="article-lead compact"><span class="kicker">Reader access</span><h1>Your reading room.</h1></div><section class="account">${inner}</section>`,{path:root+'/account',privatePage:true});}
function login(next){return accountPage(`<h2>Open your subscription</h2><p>Use the email address from checkout. We send a one-time code to subscribers.</p><form class="fields" action="${root}/account/start" method="post"><input type="hidden" name="next" value="${e(next)}"><label>Checkout email<input type="email" autocomplete="email" name="email" maxlength="254" required></label><button class="button" type="submit">Email my code</button></form><p>New to the Register? <a href="${root}/plans">Explore subscriptions</a>.</p>`);}
function verifyForm(message='If that address has an active subscription, a code is on its way.'){
  return accountPage(`<h2>Check your inbox</h2><p>${e(message)}</p><form class="fields" method="post" action="${root}/account/verify"><label>Eight-digit sign-in code<input name="code" pattern="[0-9]{8}" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required></label><button type="submit" class="button">Open my reports</button></form><a href="${root}/account">Request a fresh code</a>`);
}
function memberList(a){
  const coveredDesks=[...new Set(a.filter(x=>x.plan.type!=='focus').flatMap(x=>x.plan.desks))];
  const slugs=new Set(a.flatMap(x=>x.plan.slugs)),customers=[...new Set(a.map(x=>x.customer))];
  return accountPage(`<h2>${slugs.size?'Your reports':'Your subscription'}</h2><p>${a.length?a.map(x=>e(x.plan.name)+(x.ending?' · ends '+e(x.date?.slice(0,10)):'')).join(' · '):'We found no active Culture Register subscription for this checkout email.'}</p><div class="member-links">${coveredDesks.map(id=>`<a href="${root}/desks/${id}"><small>Industry brief</small><br>${desks[id].name} →</a>`).join('')}${Object.entries(focuses).flatMap(([desk,d])=>Object.entries(d).filter(([s])=>slugs.has(s)).map(([s,t])=>`<a href="${root}/reports/${s}"><small>${desks[desk].name}</small><br>${e(t)} →</a>`)).join('')}</div><div class="inline-actions">${customers.map((_,i)=>`<form method="post" action="${root}/account/portal"><input type="hidden" name="account" value="${i}"><button class="plain-action" type="submit">Manage billing${customers.length>1?' '+(i+1):''}</button></form>`).join('')}<form method="post" action="${root}/account/logout"><button class="plain-action" type="submit">Sign out</button></form></div><p>Tell us what you used, what was missing or what you would change. <a href="/feedback/culture-register">Send reader feedback</a>.</p>`);
}
export function createCultureSite(options={}){
  const dir=options.directory||process.env.CULTURE_DATA_DIR||(process.env.RAILWAY_VOLUME_MOUNT_PATH&&join(process.env.RAILWAY_VOLUME_MOUNT_PATH,'culture-register'));
  const admin=options.operator||process.env.CULTURE_OPERATOR_KEY?.trim();
  const site=options.origin||origin;
  const send=options.mail||sendReaderCode;
  const billing=options.billing||makeBilling({key:process.env.CULTURE_DODO_KEY?.trim(),products:productIds});
  let db,current;
  const query=(sql,...v)=>db.prepare(sql).get(...v),exec=(sql,...v)=>db.prepare(sql).run(...v);
  function init(){
    if(db)return;
    if(!dir||!admin)throw err(503,'The editorial desk is reconnecting. Please try again in a moment.');
    mkdirSync(dir,{recursive:true,mode:0o700});db=new DatabaseSync(join(dir,'readers.sqlite'));
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS codes (id TEXT PRIMARY KEY,email TEXT NOT NULL,code TEXT NOT NULL,attempts INTEGER DEFAULT 0,until INTEGER NOT NULL,destination TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,email TEXT NOT NULL,until INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS limits(k TEXT PRIMARY KEY,n INTEGER NOT NULL,until INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS counts(day TEXT NOT NULL,event TEXT NOT NULL,detail TEXT NOT NULL,n INTEGER NOT NULL,PRIMARY KEY(day,event,detail));`);
  }
  const event=(event,detail='')=>exec('INSERT INTO counts VALUES(?,?,?,1) ON CONFLICT(day,event,detail) DO UPDATE SET n=n+1',new Date().toISOString().slice(0,10),event,detail);
  const digest=(k,s)=>createHmac('sha256',admin).update(k+'|'+s).digest('hex');
  function rate(k,max,ms){
    const now=Date.now();exec('DELETE FROM limits WHERE until<?',now);
    const value=query('SELECT n FROM limits WHERE k=?',k)?.n||0;
    if(value>=max)throw err(429,'Too many requests. Please try again later.');
    exec('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=n+1',k,now+ms);
  }
  function edition(){if(current)return current;try{current=validateEdition(JSON.parse(readFileSync(join(dir,'edition.json'),'utf8')));return current;}catch{throw err(503,'The editors are preparing this edition. Please try again shortly.');}}
  function session(req){const raw=cookies(req)[names.session];return raw&&query('SELECT * FROM sessions WHERE id=? AND until>?',hash(raw),Date.now());}
  const cookie=(key,value,age)=>names[key]+'='+value+'; Path='+root+'; HttpOnly; '+'Secure; SameSite=Lax; Max-Age='+age;
  let publishing=false;
  return async function route(req,res){
    const u=new URL(req.url,site),path=u.pathname.slice(root.length).replace(/\/$/,'')||'/',post=req.method==='POST';
    const qa=req.headers['user-agent']?.includes('CultureRegister-QA');
    const channels=['homepage','outreach','partner','newsletter','organic','publication'];
    const entry=channels.includes(u.searchParams.get('src'))?u.searchParams.get('src'):null;
    function finish(status,body='',headers={}){
      res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin',...(entry&&!post?{'Set-Cookie':'cr-channel='+entry+'; Path='+root+'; HttpOnly; Secure; SameSite=Lax; Max-Age=604800'}:{}),...headers});
      res.end(req.method==='HEAD'?undefined:body);
    }
    const redirect=(location,c)=>finish(303,'',{Location:location,'Referrer-Policy':'no-referrer',...(c?{'Set-Cookie':c}:{})});
    const count=(type,detail)=>{if(!qa&&req.method!=='HEAD')event(type,detail);};
    try{
      init();
      if(!['POST','GET','HEAD'].includes(req.method))throw err(405,'That request method is unavailable.');
      if(path.startsWith('/operator/')){
        const supplied=String(req.headers.authorization||'');
        if(!timingSafeEqual(Buffer.from(hash(supplied)),Buffer.from(hash('Bearer '+admin))))throw err(404,'Page not found.');
        if(post && /^\/operator\/ledger\/[a-f0-9]{64}$/.test(path)){
          const data=await readBody(req,24000000),id=path.split('/').pop();
          if(!data.startsWith('published_utc,publisher,desk,matched_categories,source_url')||hash(data)!==id)throw err(422,'The evidence ledger fingerprint did not match.');
          const base=join(dir,'evidence');await mkdir(base,{recursive:true});
          const tmp=join(base,newToken()+'.tmp');await writeFile(tmp,data,{mode:0o600});await rename(tmp,join(base,id+'.csv'));
          return finish(200,JSON.stringify({ledger:id}),{'Content-Type':'application/json'});
        }
        const json=(status,v)=>finish(status,JSON.stringify(v),{'Content-Type':'application/json'});
        if(!post&&path==='/operator/metrics')return json(200,{revision:current?.revision||(()=>{try{return edition().revision}catch{return null}})(),counts:db.prepare(`SELECT * FROM counts WHERE day>=date('now','-100 days') ORDER BY day,event`).all()});
        if(path==='/operator/edition'&&post){
          const data=validateEdition(JSON.parse(await readBody(req,1800000)));
          try{await readFile(join(dir,'evidence',data.ledgerHash+'.csv'))}catch{throw err(422,'Upload the matching observation ledger first.');}
          if(publishing)throw err(409,'An edition update is in progress.');
          publishing=true;
          try{
            let old;try{old=edition()}catch{}
            if(old?.revision===data.revision)return json(200,{revision:data.revision});
            if((req.headers['if-match']||'')!==(old?.revision||'new'))throw err(409,'The live edition changed. Read the revision and merge the update.');
            const history=join(dir,'editions');await mkdir(history,{recursive:true});
            const body=JSON.stringify(data)+'\n',tmp=join(dir,'edition-'+newToken()+'.tmp');
            await writeFile(join(history,hash(data.revision)+'.json'),body,{mode:0o600});
            await writeFile(tmp,body,{mode:0o600});await rename(tmp,join(dir,'edition.json'));current=data;
            return json(200,{revision:data.revision,reports:data.reports.length});
          }finally{publishing=false;}
        }
        throw err(404,'Page not found.');
      }
      if(post&&req.headers.origin&&req.headers.origin!==site)throw err(403,'Open the form on Synthworx to continue.');
      const q=post?new URLSearchParams(await readBody(req,5000)):u.searchParams;
      const period=q.get('period')==='quarter'?'quarter':'month';
      const next=q.get('next')||'',safeNext=(slugSet.has(next)||deskSet.has(next))?next:'';
      if(!post){
        if(entry)count('entry',entry);
        if(path==='/'){
          const choice=q.get('desk'),desk=Object.hasOwn(desks,choice)?choice:'all';
          count('highlights',desk+'-'+period);return finish(200,home(edition(),desk,period));
        }
        if(path==='/plans'){count('plans','');return finish(200,pricing(q.get('focus'),undefined,q.get('desk')));}
        if(path==='/method')return finish(200,methodology(edition()));
        if(path==='/terms')return finish(200,terms());
        if(path==='/welcome'){
          if(u.search)return redirect(root+'/welcome');
          return finish(200,accountPage(`<h2>After checkout</h2><p>Your receipt goes to your checkout email. Once payment is complete, use that address to sign in and open your reports.</p><a class="button" href="${root}/account">Open reader access</a>`));
        }
        if(path==='/account/code')return finish(200,verifyForm());
        if(path==='/account'){
          const s=session(req);return finish(200,s?memberList(await billing.access(s.email)):login(safeNext));
        }
        if(/^\/evidence\/[a-f0-9]{64}\.csv$/.test(path)){
          let ledger;try{ledger=await readFile(join(dir,'evidence',path.split('/').pop()));}catch{throw err(404,'Observation ledger unavailable.');}
          return finish(200,ledger,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="culture-register-observations.csv"','Cache-Control':'public, max-age=31536000, immutable'});
        }
        if(path==='/sitemap.xml'){
          const pages=['/','/plans','/method','/terms',...Array.from(slugSet,s=>'/reports/'+s),...(edition().overviews||[]).map(r=>'/desks/'+r.slug)];
          return finish(200,'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.map(path=>'<url><loc>'+origin+root+path+'</loc></url>').join('')+'</urlset>',{'Content-Type':'application/xml'});
        }
        if(path.startsWith('/desks/')&&edition().overviews?.some(r=>r.slug===path.slice(7))){
          const id=path.slice(7),s=session(req);
          const allowed=s?(await billing.access(s.email)).some(x=>x.plan.type!=='focus'&&x.plan.desks.includes(id)):false;
          count(allowed?'member_read':'preview',id);return finish(200,report(edition(),id,period,allowed));
        }
        if(path.startsWith('/reports/')&&slugSet.has(path.slice(9))){
          const slug=path.slice(9),s=session(req),allowed=s?(await billing.access(s.email)).some(x=>x.plan.slugs.includes(slug)):false;
          count(allowed?'member_read':'preview',slug);return finish(200,report(edition(),slug,period,allowed));
        }
      }else{
        const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',').pop().trim();
        if(path==='/checkout'){
          const p=planById.get(q.get('plan'));
          if(!p)throw err(422,'Choose a listed subscription.');
          rate(digest('checkout',ip),60,600000);
          const previous=cookies(req)['cr-channel'];
          const source=qa?'qa':channels.includes(previous)?previous:'publication';
          const url=await billing.checkout(p,source);
          count('checkout',p.id);return redirect(url);
        }
        if(path==='/account/start'){
          const email=(q.get('email')||'').trim().toLowerCase();
          if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254)throw err(422,'Enter your checkout email address.');
          rate(digest('network',ip),25,3600000);rate(digest('email',email),4,600000);
          const token=newToken(),code=String(randomInt(0,100000000)).padStart(8,'0');
          exec('DELETE FROM codes WHERE until<?',Date.now());exec('DELETE FROM sessions WHERE until<?',Date.now());
          if((await billing.access(email)).length){
            exec('INSERT INTO codes(id,email,code,until,destination) VALUES(?,?,?,?,?)',hash(token),email,digest(token,code),Date.now()+600000,safeNext);
            try{await send(email,code);}catch(error){exec('DELETE FROM codes WHERE id=?',hash(token));throw error;}
          }
          return redirect(root+'/account/code',[cookie('challenge',token,600)]);
        }
        if(path==='/account/verify'){
          const token=cookies(req)[names.challenge]||'',row=query('SELECT * FROM codes WHERE id=? AND until>?',hash(token),Date.now());
          rate(digest('verify',ip),35,600000);
          if(!row||row.attempts>=5||!timingSafeEqual(Buffer.from(row.code),Buffer.from(digest(token,q.get('code')||'')))){
            if(row)exec('UPDATE codes SET attempts=attempts+1 WHERE id=?',row.id);
            return finish(401,verifyForm('That code is incorrect or expired. Check the latest message or request a fresh code.'));
          }
          const raw=newToken();db.exec('BEGIN IMMEDIATE');
          try{exec('DELETE FROM codes WHERE id=?',row.id);exec('INSERT INTO sessions VALUES(?,?,?)',hash(raw),row.email,Date.now()+30*86400000);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
          count('sign_in','');return redirect(root+(row.destination?(deskSet.has(row.destination)?'/desks/':'/reports/')+row.destination:'/account'),[cookie('session',raw,2592000),cookie('challenge','',0)]);
        }
        if(path==='/account/logout'){
          const s=session(req);if(s)exec('DELETE FROM sessions WHERE id=?',s.id);
          return redirect(root+'/account',[cookie('session','',0),cookie('challenge','',0)]);
        }
        if(path==='/account/portal'){
          const s=session(req);if(!s)return redirect(root+'/account');
          const ids=[...new Set((await billing.access(s.email)).map(a=>a.customer))],id=ids[Number(q.get('account')||0)];
          if(!id)throw err(403,'An active reader account is required.');
          return redirect(await billing.portal(id));
        }
      }
      throw err(404,'We could not find that page.');
    }catch(error){
      if(!error.status)console.error('Culture Register request failed',error.name,error.message?.replace(/https?:\/\/\S+/g,'[URL]').slice(0,120));
      const status=Number(error.status)||503;
      return finish(status,accountPage(`<h2>${status===404?'Page not found':'Reader desk'}</h2><p class="notice">${e(error.status?error.message:'This service is temporarily unavailable. Please try again or email hello@synthworx.com with the subject Culture Register.')}</p><a href="${root}/">Back to the edition</a>`));
    }
  };
}

