import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../../data/site';

export async function GET(context: APIContext) {
  const notes = (await getCollection('notes'))
    .filter((entry) => !entry.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: `${SITE.name} — Notes`,
    description: 'Technical notes on production AI: long-context memory and browser-agent token efficiency.',
    site: context.site ?? SITE.url,
    items: notes.map((note) => ({
      title: note.data.title,
      description: note.data.summary,
      pubDate: note.data.date,
      link: `/notes/${note.id}/`,
    })),
    customData: '<language>en-us</language>',
  });
}
