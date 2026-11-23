import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,createHmac,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';

export const issue=(status,message)=>Object.assign(Error(message),{status});
export function openStore(directory,secret) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(directory,'activity.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, at INTEGER NOT NULL, source TEXT NOT NULL, qa INTEGER NOT NULL, pack TEXT);
    CREATE TABLE IF NOT EXISTS packs(id TEXT PRIMARY KEY, customer TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS runs(sid TEXT NOT NULL, rid TEXT NOT NULL, at INTEGER NOT NULL, bucket TEXT NOT NULL, network TEXT NOT NULL,
      status TEXT NOT NULL, digest TEXT NOT NULL, reply BLOB, input INTEGER NOT NULL DEFAULT 0, output INTEGER NOT NULL DEFAULT 0,
      rating TEXT, copied INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(sid,rid));
    CREATE INDEX IF NOT EXISTS runs_bucket ON runs(bucket,status);
    CREATE INDEX IF NOT EXISTS runs_time ON runs(at);
    CREATE TABLE IF NOT EXISTS events(sid TEXT NOT NULL, at INTEGER NOT NULL, kind TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS events_time ON events(at);
  `);
  const hash = (scope,value)=>createHmac('sha256',secret).update(scope+'|'+value).digest('hex');
  const cipherKey = createHash('sha256').update('results|'+secret).digest();
  function encrypt(value) {
    const nonce=randomBytes(12), c=createCipheriv('aes-256-gcm',cipherKey,nonce);
    const data=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);
    return Buffer.concat([nonce,c.getAuthTag(),data]);
  }
  function decrypt(blob) {
    const b=Buffer.from(blob), c=createDecipheriv('aes-256-gcm',cipherKey,b.subarray(0,12));
    c.setAuthTag(b.subarray(12,28));
    return JSON.parse(Buffer.concat([c.update(b.subarray(28)),c.final()]).toString());
  }
  const query=(sql,...args)=>db.prepare(sql).get(...args);
  const exec=(sql,...args)=>db.prepare(sql).run(...args);
  const event=(sid,kind)=>exec('INSERT INTO events VALUES(?,?,?)',sid,Date.now(),kind);
  const access=sid=>query('SELECT * FROM sessions WHERE id=?',sid);
  function ensure(raw, source, qa) {
    let current=raw && access(hash('session',raw));
    if(current) return {session:current};
    const token=randomBytes(32).toString('hex'), id=hash('session',token);
    exec('INSERT INTO sessions(id,at,source,qa) VALUES(?,?,?,?)',id,Date.now(),source,qa?1:0);
    return {session:access(id),token};
  }
  function balance(s) {
    const bucket=s.pack || s.id, limit=s.pack?100:3;
    const used=query("SELECT count(*) AS n FROM runs WHERE bucket=? AND (status='ready' OR (status='pending' AND at>?))",bucket,Date.now()-90000).n;
    return {paid:!!s.pack,remaining:Math.max(0,limit-used)};
  }
  function reserve(s,id,body,network) {
    const at=Date.now(), digest=hash('request',body);
    db.exec('BEGIN IMMEDIATE');
    try {
      const prev=query('SELECT * FROM runs WHERE sid=? AND rid=?',s.id,id);
      if(prev && prev.digest!==digest) throw issue(409,'That request changed. Start a new rewrite.');
      if(prev?.reply && prev.at>at-600000) {db.exec('COMMIT');return decrypt(prev.reply);}
      if(prev?.status==='pending' && prev.at>at-90000) throw issue(409,'This rewrite is still running. Try again in a moment.');
      if(prev && !['pending','error'].includes(prev.status)) throw issue(409,'This request was already completed. Start a new rewrite.');
      if(!balance(s).remaining) throw issue(402,s.pack?'This pack has been used up. Add another pack to continue.':'Your three free rewrites are used. Add a pack to continue.');
      const day=Date.parse(new Date(at).toISOString().slice(0,10)+'T00:00:00Z');
      if(!s.pack && (query('SELECT count(*) AS n FROM runs WHERE network=? AND at>?',network,day).n>=20 ||
        query('SELECT count(*) AS n FROM runs WHERE bucket=sid AND at>?',day).n>=400)) throw issue(429,'Today’s free capacity is in use. Try again tomorrow.');
      exec("INSERT INTO runs(sid,rid,at,bucket,network,status,digest) VALUES(?,?,?,?,?,'pending',?) ON CONFLICT(sid,rid) DO UPDATE SET at=excluded.at,status='pending',bucket=excluded.bucket,network=excluded.network",s.id,id,at,s.pack||s.id,network,digest);
      db.exec('COMMIT');return null;
    } catch(e){db.exec('ROLLBACK');throw e;}
  }
  function complete(sid,id,result) {
    exec('UPDATE runs SET status=?,reply=?,input=?,output=? WHERE sid=? AND rid=?',result.kind,encrypt({kind:result.kind,text:result.text}),result.input,result.output,sid,id);
  }
  function clean(){
    exec('UPDATE runs SET reply=NULL WHERE reply IS NOT NULL AND at<?',Date.now()-600000);
    exec("UPDATE runs SET network='' WHERE network!='' AND at<?",Date.now()-86400000);
  }
  clean();const interval=setInterval(clean,60000);interval.unref();
  return {db,query,exec,hash,ensure,balance,reserve,complete,event,access,close(){clearInterval(interval);db.close();}};
}
