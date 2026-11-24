import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const site = process.env.PUBLIC_SITE_URL || 'https://synthworx.com';

export default defineConfig({
  site,
  trailingSlash: 'never',
  integrations: [sitemap({ filter: (url) => !new URL(url).pathname.startsWith('/feedback') })],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
