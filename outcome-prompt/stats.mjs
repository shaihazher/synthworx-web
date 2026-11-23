// Run through the linked Railway service. Emit only the aggregates needed by the operator.
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
const file=join(process.env.RAILWAY_VOLUME_MOUNT_PATH||'/data','outcome-prompt','activity.sqlite');
if(!existsSync(file))throw Error('Production database is not initialized');
const db=new DatabaseSync(file,{readOnly:true});
const all=(sql,...params)=>db.prepare(sql).all(...params);
const day="strftime('%Y-%m-%d',at/1000,'unixepoch')";
const sessions=all("SELECT "+day+" day,source,count(*) n FROM sessions WHERE qa=0 GROUP BY day,source");
const events=all("SELECT strftime('%Y-%m-%d',e.at/1000,'unixepoch') day,s.source,e.kind,count(*) n,count(DISTINCT e.sid) users FROM events e JOIN sessions s ON s.id=e.sid WHERE s.qa=0 GROUP BY day,s.source,e.kind");
const runs=all("SELECT strftime('%Y-%m-%d',r.at/1000,'unixepoch') day,s.source,(r.bucket!=r.sid) paid,r.status,count(*) n,count(DISTINCT r.sid) browsers,sum(r.copied) copies,sum(r.rating='closer') closer,sum(r.rating='missed') missed FROM runs r JOIN sessions s ON s.id=r.sid WHERE s.qa=0 GROUP BY day,s.source,paid,r.status");
const users=all("SELECT DISTINCT strftime('%Y-%m-%d',r.at/1000,'unixepoch') day, CASE WHEN r.bucket=r.sid THEN r.sid ELSE p.customer END actor,r.bucket!=r.sid paid,s.source FROM runs r JOIN sessions s ON s.id=r.sid LEFT JOIN packs p ON p.id=r.bucket WHERE r.status='ready' AND s.qa=0");
const usage=all("SELECT "+day+" day,sum(input) inTokens,sum(output) outTokens,sum(status='error') errors,count(*) attempts FROM runs GROUP BY day");
console.log(JSON.stringify({version:1,sessions,events,runs,users,usage}));
