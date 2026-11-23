'use strict';

(function initialise(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../caption-desk/dist/scan.js'), require('node:crypto').webcrypto);
  } else {
    root.CaptionDeskPacket = factory(CaptionQC, root.crypto);
  }
})(globalThis, function packetAPI(scanner, cryptoProvider) {
  const format = 'caption-desk-diagnostics/v1';
  const maxSourceBytes = 2 * 1024 * 1024;
  const maxPacketBytes = 8 * 1024 * 1024;

  const rules = {
    missing_id: ['Missing numeric ID', 'Structure', 'This block does not begin with a numeric cue ID.', 'Check the block boundary and add its cue number.'],
    repeated_id: ['Repeated ID', 'Structure', 'Another block already uses this numeric ID.', 'Renumber the cues in sequence for a clear editorial handoff.'],
    invalid_timecode: ['Invalid timecode', 'Structure', 'The start and end times could not be read.', 'Use HH:MM:SS,mmm --> HH:MM:SS,mmm. A period before milliseconds also works.'],
    missing_separator: ['Missing cue separator', 'Structure', 'A second timing line appears inside the caption.', 'Insert a blank line before the next cue number and rescan.'],
    empty_cue: ['Empty cue', 'Structure', 'This cue has no visible caption text.', 'Restore the caption or remove the empty event after checking the picture.'],
    too_many_lines: ['Too many lines', 'Layout', n => n + ' lines in this event.', 'Rebalance into at most two lines, or split at a natural pause.'],
    long_line: ['Long line', 'Layout', n => n + ' visible characters on the longest line.', 'Break the line at a phrase boundary. Keep each line to 43 characters or fewer.'],
    invalid_duration: ['Invalid duration', 'Timing', 'The end time is at or before the start.', 'Correct both timestamps against the audio.'],
    duration: ['Cue duration', 'Timing', n => n + ' ms on screen.', 'Aim for 600–8,000 ms while preserving sync.'],
    speed: ['Reading speed', 'Reading', n => n.toFixed(1) + ' visible characters per second.', 'Review against the audio. Allow more display time or split the cue at a pause.'],
    sequence: ['Out of order', 'Timing', 'Starts before the preceding cue.', 'Check the order of events against the cut.'],
    overlap: ['Overlap', 'Timing', n => 'Starts before cue block ' + n + ' has ended.', 'Check the audio and leave at least 42 ms between events.'],
    short_gap: ['Short gap', 'Timing', n => n + ' ms since the previous event ended.', 'Check the audio and leave at least 42 ms between events.'],
  };
  const byName = new Map(Object.entries(rules).map(([code, row]) => [row[0],code]));

  function matchesSchema(obj, fields) {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj) &&
      Object.keys(obj).length === fields.length && fields.every(f => Object.hasOwn(obj, f));
  }
  function safeInteger(n,min,max) {
    return Number.isSafeInteger(n) && n >= min && n <= max;
  }
  function timestamp(ms) {
    if (ms === null) return '';
    const clock = [Math.floor(ms/3600000), Math.floor(ms/60000)%60, Math.floor(ms/1000)%60];
    return clock.map(v => String(v).padStart(2,'0')).join(':') + ',' + String(ms%1000).padStart(3,'0');
  }
  function requirePacket(value, message) {
    if (!value) throw new Error('Invalid diagnostics packet. ' + message);
  }
  function expand(packet) {
    requirePacket(matchesSchema(packet,['format','sha256','bytes','cues','findings']) && packet.format === format, 'Use Caption Desk diagnostics v1.');
    requirePacket(typeof packet.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(packet.sha256), 'The file digest must be 64 lowercase hexadecimal characters.');
    requirePacket(safeInteger(packet.bytes,1,maxSourceBytes) && safeInteger(packet.cues,1,packet.bytes), 'Invalid source size or cue count.');
    requirePacket(Array.isArray(packet.findings) && packet.findings.length <= Math.min(100000,packet.cues * Object.keys(rules).length), 'Invalid finding count.');
    const seen = new Set();
    const issues = packet.findings.map(f => {
      requirePacket(matchesSchema(f,['block','line','cueId','startMs','endMs','rule','value']), 'Unexpected finding fields.');
      requirePacket(typeof f.rule === 'string' && Object.hasOwn(rules,f.rule), 'Unknown technical rule.');
      requirePacket(safeInteger(f.block,1,packet.cues) && safeInteger(f.line,1,packet.bytes), 'Invalid block or source line.');
      requirePacket(typeof f.cueId === 'string' && /^\d{0,80}$/u.test(f.cueId), 'Invalid numeric cue ID.');
      requirePacket([f.startMs,f.endMs].every(ms => ms === null || safeInteger(ms,0,Number.MAX_SAFE_INTEGER)), 'Invalid timestamp.');
      const key = f.block + ':' + f.rule;
      requirePacket(!seen.has(key), 'Duplicate rule for one block.');
      seen.add(key);
      const [rule,group,detail,action] = rules[f.rule];
      if (typeof detail === 'function') {
        requirePacket(typeof f.value === 'number' && Number.isFinite(f.value) && f.value >= 0 && f.value <= Number.MAX_SAFE_INTEGER, 'Invalid measurement.');
        requirePacket(f.rule === 'speed' || Number.isSafeInteger(f.value), 'Expected a whole-number measurement.');
        if (f.rule === 'overlap') requirePacket(safeInteger(f.value,1,packet.cues), 'Overlap references an unknown cue block.');
      } else {
        requirePacket(f.value === null, 'Unexpected measurement.');
      }
      return { block:f.block, cueId:f.cueId, line:f.line, start:timestamp(f.startMs), end:timestamp(f.endMs),
        rule,group,detail:typeof detail === 'function' ? detail(f.value) : detail,action };
    });
    return {sha256:packet.sha256,bytes:packet.bytes,cues:packet.cues,issues,hashSource:'Sender-reported from browser'};
  }

  async function fromBytes(input) {
    if (!(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) throw new Error('Supply UTF-8 SRT bytes.');
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (!bytes.length || bytes.length > maxSourceBytes) throw new Error('Choose a nonempty SRT of at most 2 MiB.');
    let text;
    try { text = new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
    catch { throw new Error('Save the SRT as UTF-8 and try again.'); }
    if (!text.trim() || text.includes('\0')) throw new Error('Choose a nonempty UTF-8 SRT.');
    const {cues,findings} = scanner.scan(text);
    const sha256 = Array.from(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes)), v => v.toString(16).padStart(2,'0')).join('');
    const packet = {format,sha256,bytes:bytes.length,cues:cues.length,findings:findings.map(f => {
      const cue = cues[f.index - 1];
      const rule = byName.get(f.rule);
      if (!rule) throw new Error('Update the packet exporter to support this scanner rule.');
      let value = null;
      if (typeof rules[rule][2] === 'function') {
        const measurement = /\d+(?:\.\d+)?/u.exec(f.detail);
        if (!measurement) throw new Error('The scanner returned an unreadable measurement.');
        value = Number(measurement[0]);
      }
      return {block:f.index,line:f.line,cueId:/^\d{0,80}$/u.test(cue.id) ? cue.id : '',
        startMs:safeInteger(cue.start,0,Number.MAX_SAFE_INTEGER) ? cue.start : null,
        endMs:safeInteger(cue.end,0,Number.MAX_SAFE_INTEGER) ? cue.end : null,rule,value};
    })};
    expand(packet);
    if (new TextEncoder().encode(JSON.stringify(packet)).byteLength > maxPacketBytes) throw new Error('This diagnostics packet exceeds 8 MiB. Export a shorter reel or contact the desk.');
    return packet;
  }
  async function fromFile(file) {
    if (!file || typeof file.name !== 'string' || !/\.srt$/iu.test(file.name)) throw new Error('Choose an .srt file.');
    if (file.size > maxSourceBytes) throw new Error('Choose an SRT of at most 2 MiB.');
    return fromBytes(await file.arrayBuffer());
  }
  return {fromFile,fromBytes,expand,format,maxSourceBytes,maxPacketBytes};
});
