import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/caseStudies' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    label: z.enum([
      'Built at Amazon',
      'Independent R&D',
      'Independent product',
      'Client engagement',
    ]),
    year: z.string(),
    sector: z.string(),
    summary: z.string(),
    metric: z.object({ value: z.string(), label: z.string() }),
    stack: z.array(z.string()).default([]),
    stats: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    order: z.number().default(99),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    date: z.coerce.date(),
    readingTime: z.string(),
    summary: z.string(),
    order: z.number().default(99),
    draft: z.boolean().default(false),
  }),
});

export const collections = { caseStudies, notes };
