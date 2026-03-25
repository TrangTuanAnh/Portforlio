// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example-portfolio.pages.dev',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
