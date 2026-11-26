export {};

const $ = id => document.getElementById(id);
const source = $('source');
const editable = $('editable');
const query = new URLSearchParams(location.search);
const panels = [...document.querySelectorAll('[data-scenario]')];
const scenarioInputs = [...document.querySelectorAll('input[name="scenario"]')];
const votes = [...document.querySelectorAll('[data-vote]')];
const publishedDrafts = JSON.parse($('example-drafts').textContent);

function referralSource() {
  const explicit = query.get('src') || query.get('utm_source');
  if (explicit) return explicit;
  if (!document.referrer) return 'direct';
  let host;
  try { host = new URL(document.referrer).hostname; } catch { return 'direct'; }
  if (/(^|\.)(google|bing|duckduckgo)\./i.test(host)) return 'search';
  if (host === 'promoteindex.com') return 'promoteindex';
  if (host === 'postlaunchkit.com') return 'postlaunchkit';
  if (host === 'aisotools.com') return 'aiso';
  return host === location.hostname ? 'direct' : 'referral';
}

async function post(route, data) {
  const response = await fetch('/outcome-prompt/api/' + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  let body;
  try { body = await response.json(); }
  catch { throw Error('The service is unavailable. Please retry.'); }
  if (!response.ok) {
    const error = Error(body.message || 'Please try again.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function showBalance({ remaining, paid }) {
  const units = remaining === 1 ? 'rewrite' : 'rewrites';
  $('quota').textContent = remaining + (paid ? ' pack ' : ' free ') + units + ' left';
}

let session;
function loadBalance() {
  session = post('state', { source: referralSource() }).then(showBalance).catch(error => {
    session = null;
    $('quota').textContent = 'Balance unavailable';
    $('status').textContent = error.message;
    throw error;
  });
  return session;
}
const ready = () => session || loadBalance();
void ready().catch(() => {});

let selectedScenario = scenarioInputs.find(input => input.checked).value;
let previous = '';
let record = null;
let pending = null;
let busy = false;
let loadedExample = '';

function exampleDraft(key) {
  const panel = panels.find(item => item.dataset.scenario === key);
  if (panel) return $('opening').textContent.trim() + ' ' + panel.querySelector('.case-context').textContent.trim();
  return Object.hasOwn(publishedDrafts, key) ? publishedDrafts[key] : '';
}

function selectScenario(key) {
  selectedScenario = key;
  panels.forEach(panel => { panel.hidden = panel.dataset.scenario !== key; });
  scenarioInputs.forEach(input => { input.checked = input.value === key; });
}
scenarioInputs.forEach(input => input.addEventListener('change', () => selectScenario(input.value)));
$('scenarios').hidden = false;

function updateDraftControls() {
  $('counter').textContent = source.value.length.toLocaleString() + ' / 4,000';
  // Switching the worked example never replaces a visitor's own writing.
  $('example').hidden = !!previous || (!!source.value.trim() && source.value !== loadedExample);
}

const requested = query.get('example');
if (scenarioInputs.some(input => input.value === requested)) selectScenario(requested);
if (requested) loadedExample = exampleDraft(requested);
source.value = loadedExample;
updateDraftControls();

$('example').onclick = () => {
  if (busy) return;
  loadedExample = exampleDraft(selectedScenario);
  source.value = loadedExample;
  updateDraftControls();
  source.focus();
};
source.addEventListener('input', updateDraftControls);

function showDraft() {
  $('rewrite').hidden = false;
  $('result').hidden = true;
  $('editor-intro').hidden = !!previous;
  $('back-result').hidden = !previous;
  $('editor-title').textContent = previous ? 'Refine your prompt' : 'Rewrite your request';
  $('source-label').textContent = previous
    ? (record.kind === 'clarify' ? 'Add the missing detail' : 'What would you like to change?')
    : 'Your draft';
  $('go').textContent = previous ? 'Update my prompt' : 'Rewrite my request';
  $('submit-note').textContent = previous
    ? 'DeepSeek processes your changes. A completed revision uses one rewrite.'
    : 'DeepSeek processes your draft when you submit it.';
  source.placeholder = previous ? '' : 'Make me ten Instagram posts. Six seats in Saturday’s pottery class are still empty.';
  $('status').textContent = '';
  updateDraftControls();
}

function showResult() {
  $('rewrite').hidden = true;
  $('editor-intro').hidden = true;
  $('result').hidden = false;
  const titles = { ready: 'Your outcome prompt', clarify: 'One detail to clarify', declined: 'A different request is needed' };
  $('editor-title').textContent = titles[record.kind];
  $('status').textContent = record.kind === 'ready' ? '' : 'Your balance is unchanged.';
  $('editor-title').focus();
}

function syncLocalEdits() {
  const empty = !editable.value.trim();
  $('copy').disabled = empty;
  $('revise').disabled = empty;
  $('rating').hidden = editable.value !== record.text;
}

function receiveResult(data, input) {
  record = { id: pending.id, text: data.text, kind: data.kind, source: input, previous };
  pending = null;
  showBalance(data);
  const done = record.kind === 'ready';
  $('review').hidden = !done;
  $('answer').hidden = done;
  $('answer').textContent = done ? '' : data.text;
  $('copy').hidden = !done;
  $('revise').hidden = data.kind === 'declined';
  $('revise').disabled = false;
  $('revise').textContent = data.kind === 'clarify' ? 'Add detail' : 'Ask for a revision';
  $('rating').hidden = !done;
  votes.forEach(button => button.removeAttribute('aria-pressed'));
  if (done) {
    editable.value = data.text;
    $('before-text').textContent = previous || input;
    $('compare-label').textContent = previous ? 'Compare with earlier wording' : 'Compare with my draft';
    $('change-block').hidden = !previous;
    $('change-text').textContent = previous ? input : '';
    $('compare').open = false;
    syncLocalEdits();
  }
  showResult();
}

$('rewrite').onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  const input = source.value.trim();
  if (!pending || pending.source !== input || pending.previous !== previous) {
    pending = { id: crypto.randomUUID(), source: input, previous };
  }
  busy = true;
  $('go').disabled = $('example').disabled = $('back-result').disabled = true;
  source.readOnly = true;
  $('status').textContent = 'Rewriting…';
  try {
    await ready();
    receiveResult(await post('rewrite', pending), input);
  } catch (error) {
    $('status').textContent = error.message;
    if (error.status === 402) {
      $('billing-status').textContent = error.message;
      $('pack').scrollIntoView({ block: 'center' });
    }
  } finally {
    busy = false;
    $('go').disabled = $('example').disabled = $('back-result').disabled = false;
    source.readOnly = false;
  }
};

editable.addEventListener('input', () => {
  if (record?.kind !== 'ready') return;
  syncLocalEdits();
  $('status').textContent = '';
});
$('copy').onclick = async () => {
  if (record?.kind !== 'ready' || !editable.value.trim()) return;
  const id = record.id;
  try {
    await navigator.clipboard.writeText(editable.value);
    $('status').textContent = 'Prompt copied.';
    void post('feedback', { id, value: 'copy' }).catch(() => {});
  } catch {
    editable.focus();
    editable.select();
    $('status').textContent = 'Your prompt is selected. Use your device’s Copy command.';
  }
};
$('revise').onclick = () => {
  if (!record || busy) return;
  previous = record.kind === 'clarify'
    ? [record.previous, record.source, record.text].filter(Boolean).join('\n').slice(-4500)
    : editable.value.trim();
  source.value = '';
  pending = null;
  showDraft();
  source.focus();
};
$('back-result').onclick = () => { if (record && !busy) showResult(); };
$('fresh').onclick = () => {
  if (busy) return;
  previous = loadedExample = '';
  record = pending = null;
  source.value = editable.value = '';
  $('before-text').textContent = $('change-text').textContent = $('answer').textContent = '';
  showDraft();
  source.focus();
};
votes.forEach(button => button.onclick = async () => {
  if (record?.kind !== 'ready') return;
  const id = record.id;
  try {
    await post('feedback', { id, value: button.dataset.vote });
    if (record?.id !== id) return;
    votes.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    $('status').textContent = 'Thanks for the feedback.';
  } catch (error) { $('status').textContent = error.message; }
});

$('buy').onclick = async () => {
  $('buy').disabled = true;
  $('billing-status').textContent = 'Opening checkout…';
  try { await ready(); location.assign((await post('checkout', {})).url); }
  catch (error) { $('billing-status').textContent = error.message; $('buy').disabled = false; }
};
$('redeem').onsubmit = async event => {
  event.preventDefault();
  const button = $('redeem').querySelector('button');
  button.disabled = true;
  try {
    await ready();
    const balance = await post('pack', { key: $('key').value.trim() });
    showBalance(balance);
    $('key').value = '';
    $('billing-status').textContent = 'Pack ready. ' + balance.remaining + ' rewrites available.';
    $('editor').scrollIntoView({ block: 'center' });
    (source.closest('[hidden]') ? $('editor-title') : source).focus();
  } catch (error) { $('billing-status').textContent = error.message; }
  finally { button.disabled = false; }
};
if (query.get('unlock') === '1') $('unlock').open = true;
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    $('buy').disabled = false;
    $('billing-status').textContent = '';
    void loadBalance().catch(() => {});
  }
});
