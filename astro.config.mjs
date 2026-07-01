// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Ваш публичный адрес. Влияет на canonical, sitemap и абсолютные ссылки.
  // Если позже подключите свой домен — поменяйте здесь.
  site: 'https://novarabuild.netlify.app',
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
