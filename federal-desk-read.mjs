// Private Railway SSH command. This file is outside the site's static directory.
import path from 'node:path';import {readdir,readFile} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {createInterface} from 'node:readline';
const state=process.env.FEDERAL_DESK_DATA||path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH||'/data','federal-evidence-desk');
const fd=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});const counts=new Map();
try{const stream=createInterface({input:createReadStream(path.join(state,'events.ndjson')),crlfDelay:Infinity});for await(const line of stream){if(!line)continue;const r=JSON.parse(line);const key=JSON.stringify([fd.format(new Date(r.at)),r.name,r.source,r.path||'']);counts.set(key,(counts.get(key)||0)+1);}}catch(e){if(e.code!=='ENOENT')throw e;}
let names=[];try{names=await readdir(path.join(state,'feedback'));}catch(e){if(e.code!=='ENOENT')throw e;}
const feedback=[];for(const name of names.filter(n=>/^[a-f0-9-]+\.json$/.test(n))){const f=JSON.parse(await readFile(path.join(state,'feedback',name),'utf8'));feedback.push(f);}
console.log(JSON.stringify({version:1,counts:[...counts].map(([k,count])=>{const [date,name,source,page]=JSON.parse(k);return {date,name,source,page,count};}),feedback}));
