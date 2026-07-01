// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://novara.studio',
  integrations: [sitemap()],
  compressHTML: true,
  server: {
    host: true, // bind on all interfaces (incl. 127.0.0.1), not just IPv6 ::1
    port: 4321,
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
