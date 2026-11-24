export const products = [
  {
    id: 'arrival',
    name: 'Arrival Slip',
    subject: 'Form delivery',
    href: '/arrival-slip/?src=referral',
    task: 'Trace a contact form',
    description: 'Match a test inquiry to the entry in your client’s inbox or CRM. Print a dated receipt for their care report.',
  },
  {
    id: 'captions',
    name: 'Caption Desk',
    subject: 'Subtitle checks',
    href: '/caption-desk',
    task: 'Check a film’s captions',
    description: 'Scan an English SRT for timing and layout problems. If your team handles repeat deliveries, get a fix list and a recheck of the editor’s revision.',
  },
  {
    id: 'federal',
    name: 'Federal Evidence Desk',
    subject: 'Federal résumés',
    href: '/federal-desk/?src=synthworx',
    task: 'Tailor a federal résumé',
    description: 'Find words your résumé bullets share with a U.S. federal vacancy. Use the offline desk to build a two-page résumé for that job.',
  },
  {
    id: 'outcome',
    name: 'Outcome Prompt',
    subject: 'AI prompt rewrites',
    href: '/outcome-prompt/?src=synthworx',
    task: 'Give an AI a clearer brief',
    description: 'Start with a rough request and say what you need it for. Get an editable prompt to take to your AI agent.',
  },
  {
    id: 'pikki',
    name: 'Pikki Jobs',
    subject: 'H-1B transfer job search',
    href: 'https://pikki.synthworx.com/?utm_source=synthworx&utm_campaign=product-index',
    task: 'Find a transfer employer',
    description: 'Search U.S. H-1B filing history and see what open roles say about sponsorship before applying.',
  },
] as const;

export const services = [
  { id: 'audience', name: 'Audience Cut', subject: 'Film release strategy', href: '/audience-cut' },
  { id: 'culture', name: 'Culture Register', subject: 'U.S. culture research', href: '/culture-register/?src=homepage' },
] as const;

export type ProductId = (typeof products)[number]['id'];
export type IndexId = ProductId | (typeof services)[number]['id'];
