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
    id: 'offhours',
    name: 'Offhours Scout',
    subject: 'Movies, books & games',
    href: '/offhours',
    task: 'Find tonight’s story',
    description: 'Choose a mood and get a movie to watch, a book to read, and a game to play, with a reason for each pick.',
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
    name: 'Pikki',
    subject: 'Job leads & referrals',
    href: 'https://pikki.synthworx.com/',
    task: 'Investigate a job listing',
    description: 'Flag suspicious postings, find people who could refer you, and prepare applications with a Chrome extension.',
  },
] as const;

export type ProductId = (typeof products)[number]['id'];
