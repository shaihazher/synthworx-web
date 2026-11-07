import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const pages = [
  ['index.html', ['AI that', 'survives', 'Start a strategy session', '$1,500']],
  ['work/index.html', ['Four systems', 'Built at Amazon', 'Independent R&amp;D']],
  ['services/index.html', ['Published prices', '$1,500', '$12,500', '$35,000', '$150K']],
  ['contact/index.html', ['Start with', '$1,500', '$12,500', 'within 14 days']],
  ['automation/index.html', ['holding the process', 'Automation Diagnostic', '$12,500', '$1,500', '9 years in Amazon operations']],
  ['products/index.html', ['Pikki', 'Tappi', 'AI Tutor']],
  ['about/index.html', ['Amazon', 'Chennai', 'linkedin.com/in/azeruddinsheikh']],
  ['notes/index.html', ['Long-context memory', 'What a paid AI diagnostic', 'seven ways']],
  ['notes/what-a-diagnostic-finds/index.html', ['What a paid AI diagnostic actually finds']],
  ['notes/seven-production-failures/index.html', ['The seven ways production AI fails']],
  ['proof/index.html', ['Proof library', 'professional references']],
  ['security/index.html', ['NDA', 'No training']],
  ['privacy/index.html', ['Privacy policy']],
  ['terms/index.html', ['Website terms']],
];

test('all primary pages are built', () => {
  for (const [page] of pages) {
    assert.ok(exists(page), `missing ${page}`);
  }
  assert.ok(exists('404.html'), 'missing 404');
});

test('pages contain the core proof and offer copy', () => {
  for (const [page, strings] of pages) {
    const html = read(page);
    for (const s of strings) {
      assert.ok(html.includes(s), `${page} missing "${s}"`);
    }
  }
});

test('every page has title, description, and canonical', () => {
  for (const [page] of pages) {
    const html = read(page);
    assert.match(html, /<title>[^<]+<\/title>/, `${page} missing title`);
    assert.match(html, /<meta name="description" content="[^"]+"/, `${page} missing description`);
    assert.match(html, /<link rel="canonical" href="https:\/\/synthworx\.com/, `${page} missing canonical`);
  }
});

test('internal links resolve', () => {
  const missing = [];
  for (const [page] of pages) {
    const html = read(page);
    for (const href of html.matchAll(/href="([^"]+)"/g)) {
      const value = href[1];
      if (/^(https?:|mailto:|tel:|#)/.test(value)) continue;
      const clean = value.split('#')[0].split('?')[0];
      if (!clean) continue;
      let target = path.join(root, clean.replace(/^\//, ''));
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target)) missing.push(`${page} -> ${value}`);
    }
  }
  assert.deepEqual(missing, [], `broken internal links:\n${missing.join('\n')}`);
});

test('case study PDFs exist and are non-trivial', () => {
  const slugs = ['amazon-llm-at-scale', 'kamaloki-long-context', 'tappi-browser', 'pikki'];
  for (const slug of slugs) {
    const file = path.join(root, 'pdfs', `${slug}.pdf`);
    assert.ok(fs.existsSync(file), `missing ${slug}.pdf`);
    assert.ok(fs.statSync(file).size > 50_000, `${slug}.pdf is too small`);
  }
});

test('SEO and crawler assets exist', () => {
  assert.ok(exists('robots.txt'));
  assert.ok(exists('sitemap-index.xml'));
  assert.ok(exists('notes/rss.xml'));
  assert.ok(exists('.well-known/security.txt'));
  assert.ok(exists('images/og.png'));
  assert.ok(exists('images/azeruddin-sheikh.jpg'));
  assert.ok(exists('images/azeruddin-sheikh-portrait.jpg'));

  const robots = read('robots.txt');
  assert.match(robots, /Sitemap: https:\/\/synthworx\.com\/sitemap-index\.xml/);

  const rss = read('notes/rss.xml');
  assert.ok(rss.includes('Long-context memory'));
  assert.ok(rss.includes('token efficiency'));
  assert.ok(rss.includes('seven ways production AI fails'));
  assert.ok(rss.includes('paid AI diagnostic'));

  const security = read('.well-known/security.txt');
  assert.match(security, /Contact: mailto:hello@synthworx\.com/);
});

test('the old $3,500 session price is gone', () => {
  for (const page of ['services/index.html', 'contact/index.html']) {
    assert.ok(!read(page).includes('$3,500'), `${page} still contains $3,500`);
  }
});

test('no placeholder or fake content markers', () => {
  const banned = [
    /lorem ipsum/i,
    /TODO:/,
    /000-0000/,
    /example\.com\/placeholder/i,
    /testimonial placeholder/i,
  ];
  for (const [page] of pages) {
    const html = read(page);
    for (const pattern of banned) {
      assert.ok(!pattern.test(html), `${page} contains banned marker ${pattern}`);
    }
  }
});
