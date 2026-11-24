export const products = [
  {
    id: 'arrival',
    name: 'Arrival Slip',
    subject: 'Form delivery',
    href: '/arrival-slip/?src=referral',
    task: 'Trace a contact form',
    description: 'Check whether a test inquiry reached the right inbox or CRM. Give your client a dated receipt of what you found.',
  },
  {
    id: 'captions',
    name: 'Caption Desk',
    subject: 'Subtitle checks',
    href: '/caption-desk',
    task: 'Check a film’s captions',
    description: 'Scan an English subtitle file for overlapping cues, long lines, and captions that disappear too soon.',
  },
  {
    id: 'federal',
    name: 'Federal Evidence Desk',
    subject: 'Federal résumés',
    href: '/federal-desk/?src=synthworx',
    task: 'Tailor a federal résumé',
    description: 'Compare your résumé bullets with a U.S. federal job announcement and see which requirements your experience supports.',
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

export type ProductId = (typeof products)[number]['id'];
