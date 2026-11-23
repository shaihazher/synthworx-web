'use strict';
const CaptionQC = (() => {
  const timePair = /^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})\s*-->\s*(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/;
  const strip = line => line.replace(/<\/?(?:i|b|u|font)(?:\s[^>]*)?>/gi, '');
  const chars = text => Array.from(text).length;
  function ms(h,m,s,f) { return +h*3600000 + +m*60000 + +s*1000 + +f; }
  function scan(input) {
    const cleaned = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const blocks = [], findings = [];
    let lines = [], first = 1;
    function finish() {
      if (lines.length) blocks.push({lines, line:first});
      lines = [];
    }
    cleaned.split('\n').forEach((content,i) => {
      if (!content.trim()) { finish(); return; }
      if (!lines.length) first = i+1;
      lines.push(content);
    });
    finish();
    let previous = null, furthest = null;
    const ids = new Set();
    const cues = blocks.map((block,index) => {
      const {lines, line} = block;
      const hasID = /^\d+$/.test(lines[0].trim());
      const ti = hasID ? 1 : 0;
      const stamp = (lines[ti] || '').trim();
      const cue = {index:index+1, id:hasID ? lines[0].trim() : '', line, stamp, lines, ti};
      const issue = (rule,group,detail,action) => findings.push({index:cue.index,id:cue.id,line,stamp,rule,group,detail,action});
      if (!hasID) issue('Missing numeric ID','Structure','This block does not begin with a numeric cue ID.','Check the block boundary and add its cue number.');
      else if (ids.has(cue.id)) issue('Repeated ID','Structure','Another block already uses this numeric ID.','Renumber the cues in sequence for a clear editorial handoff.');
      if (hasID) ids.add(cue.id);
      const body = lines.slice(ti+1);
      cue.body = body;
      const match = timePair.exec(stamp);
      if (!match) issue('Invalid timecode','Structure','The start and end times could not be read.','Use HH:MM:SS,mmm --> HH:MM:SS,mmm. A period before milliseconds also works.');
      if (body.some(row=>row.includes('-->') && /\d:\d{2}/.test(row))) issue('Missing cue separator','Structure','A second timing line appears inside the caption.','Insert a blank line before the next cue number and rescan.');
      if (!body.length || !body.map(strip).join('').trim()) issue('Empty cue','Structure','This cue has no visible caption text.','Restore the caption or remove the empty event after checking the picture.');
      if (body.length>2) issue('Too many lines','Layout',body.length+' lines in this event.','Rebalance into at most two lines, or split at a natural pause.');
      const widths = body.map(text=>chars(strip(text)));
      const widest = widths.reduce((a,b)=>Math.max(a,b),0);
      if (widest>43) issue('Long line','Layout',widest+' visible characters on the longest line.','Break the line at a phrase boundary. Keep each line to 43 characters or fewer.');
      if (match) {
        cue.start=ms(...match.slice(1,5));
        cue.end=ms(...match.slice(5));
        const duration=cue.end-cue.start;
        if (duration<=0) issue('Invalid duration','Timing','The end time is at or before the start.','Correct both timestamps against the audio.');
        else {
          if (duration<600 || duration>8000) issue('Cue duration','Timing',duration+' ms on screen.','Aim for 600–8,000 ms while preserving sync.');
          const length=chars(body.map(strip).join(' ').trim());
          if (length*1000>25*duration) issue('Reading speed','Reading', (length*1000/duration).toFixed(1)+' visible characters per second.','Review against the audio. Allow more display time or split the cue at a pause.');
        }
        if (previous && cue.start < previous.start) issue('Out of order','Timing','Starts before the preceding cue.','Check the order of events against the cut.');
        if (furthest) {
          const gap=cue.start-furthest.end;
          if (gap<42) issue(gap<0?'Overlap':'Short gap','Timing',gap<0?'Starts before cue block '+furthest.index+' has ended.':gap+' ms since the previous event ended.','Check the audio and leave at least 42 ms between events.');
        }
        if (duration>0 && (!furthest || cue.end>furthest.end)) furthest=cue;
        previous=cue;
      }
      return cue;
    });
    return {cues,findings,cleaned};
  }
  function rewrap(text) {
    const report=scan(text);
    const out=report.cleaned.split('\n');
    let changed=0;
    for (const c of report.cues) {
      if (!c.id || c.start==null || c.body.length!==1) continue;
      const line=c.body[0];
      if (chars(line)<=43 || chars(line)>87 || /[<>{}\[\]\t]|^\s*[-–—(]|  |^\s|\s$/.test(line)) continue;
      let best=null;
      for (let i=1;i<line.length-1;i++) {
        if(line[i]!==' ') continue;
        const a=line.slice(0,i),b=line.slice(i+1);
        const left=chars(a),right=chars(b),diff=Math.abs(left-right);
        if (left<=43 && right<=43 && (!best || diff<best.diff)) best={a,b,diff};
      }
      if (best) {out[c.line-1+c.ti+1]=best.a+'\n'+best.b; changed++;}
    }
    return {text:out.join('\n'),changed};
  }
  return {scan,rewrap};
})();
if (typeof module!=='undefined') module.exports=CaptionQC;
