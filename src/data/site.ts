export const SITE = {
  name: 'Synthworx',
  legalName: 'Synthworx DNS Ventures LLC',
  owner: 'Azeruddin Sheikh',
  title: 'AI Systems Architect & Consultant',
  email: 'hello@synthworx.com',
  location: 'Chennai, India',
  timezone: 'IST (UTC+5:30) · 8–11am ET overlap',
  url: 'https://synthworx.com',
  description:
    'Amazon ML Architect. I help mid-market software companies fix slow, expensive, and unreliable AI systems — and get them into production.',
  proofBar:
    'Amazon ML Architect · 2M+ requests/hour at 99.99% · 80% latency reduction · $20M+ savings',
  proofBarLong:
    'Amazon ML Architect · Led 20+ engineers · 2M+ requests/hour at 99.99% · 80% inference-latency reduction · $20M+ savings · Shipped AI across browser, mobile, and local inference.',
  github: 'https://github.com/shaihazher',
  linkedin: 'https://www.linkedin.com/in/azeruddinsheikh/',
  pikki: 'https://pikki.synthworx.com',
};

export const NAV = [
  { href: '/work', label: 'Work' },
  { href: '/services', label: 'Services & fees' },
  { href: '/products', label: 'Products' },
  { href: '/notes', label: 'Notes' },
  { href: '/about', label: 'About' },
];

export const OFFERS = [
  {
    id: 'diagnostic',
    num: '01',
    name: 'AI Production Diagnostic',
    price: '$12,500',
    duration: '2 weeks',
    outcome: 'Whole-stack audit, cost and latency model, risk register, 90-day roadmap, go/no-go.',
    featured: true,
  },
  {
    id: 'sprint',
    num: '02',
    name: 'LLM Cost & Latency Sprint',
    price: '$35,000',
    duration: '4 weeks',
    outcome: 'Measurable reduction in cost and/or latency, with production-safe changes and an eval harness.',
  },
  {
    id: 'pilot',
    num: '03',
    name: 'Pilot-to-Production Sprint',
    price: '$75,000',
    duration: '6–8 weeks',
    outcome: 'One AI workflow running in production with evals, guardrails, observability, and handoff.',
  },
  {
    id: 'build',
    num: '04',
    name: 'AI System Build',
    price: '$150K–$250K',
    duration: '3–6 months',
    outcome: 'Full product or agent platform, production-grade, milestone-based, with a 30-day shadow period.',
  },
  {
    id: 'fractional',
    num: '05',
    name: 'Fractional AI Architect',
    price: '$15K–$25K/mo',
    duration: '3-month minimum',
    outcome: 'Senior AI leadership 4–6 days a month: architecture, hiring, vendor selection, board reporting.',
  },
  {
    id: 'session',
    num: '06',
    name: 'Paid Strategy Session',
    price: '$3,500',
    duration: '90 minutes',
    outcome: 'Recorded working session, 1-page memo, three prioritized recommendations. Credited to a diagnostic.',
  },
  {
    id: 'dd',
    num: '07',
    name: 'Technical Due Diligence',
    price: '$25K–$50K/deal',
    duration: '1–2 weeks',
    outcome: 'Code and architecture review, scalability, security, cost, team, IP, and model risk. Red-flag memo.',
  },
  {
    id: 'workshop',
    num: '08',
    name: 'Executive AI Workshop',
    price: '$10,000/day',
    duration: '1 day',
    outcome: 'AI opportunity map, build-vs-buy, risk framework, and a 90-day plan for the leadership team.',
  },
];

export const PROOF_STATS = [
  { value: '2M+', label: 'requests per hour' },
  { value: '99.99%', label: 'availability in production' },
  { value: '80%', label: 'inference latency reduction' },
  { value: '$20M+', label: 'savings delivered' },
];

export const WORK_WITH = [
  'US B2B SaaS, vertical software, and data platforms',
  '$10M–$150M revenue, 100–1,000 employees',
  '20–150 engineers, 0–3 ML specialists, no senior production ML architect',
  'Document- or knowledge-heavy workflows',
  'At least one LLM feature in production or a funded pilot',
];

export const NOT_A_FIT = [
  'Companies with no engineering team to build alongside',
  'Pure strategy work with no access to systems or data',
  'Teams that need staff augmentation or hourly development',
  'Anyone looking for a free discovery call or a free proposal',
];

export const HOW_I_WORK = [
  {
    title: 'Diagnose the whole stack',
    body: 'Data and retrieval, model and inference, orchestration and evals. Most production failures are not prompt problems.',
  },
  {
    title: 'Fix the highest-leverage problem first',
    body: 'One change that moves cost, latency, or reliability. Measured against a baseline agreed before the work starts.',
  },
  {
    title: 'Ship with evals, guardrails, and observability',
    body: 'A system that fails loudly, names its failures, and can be operated by your team without me.',
  },
  {
    title: 'Hand off with runbooks',
    body: 'Written architecture decisions, cost model, failure modes, and on-call notes. Your team keeps the code.',
  },
];
