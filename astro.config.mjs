// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// `base` is environment-driven so the SAME source builds for two targets:
//   • GitHub Pages project site   → default '/uni-graduation' (lives under that path)
//   • Docker / server root hosting → set PUBLIC_BASE_PATH=/  before `npm run build`
// Every link uses import.meta.env.BASE_URL, so this `base` propagates everywhere.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://imhemed.github.io',
  base: process.env.PUBLIC_BASE_PATH ?? '/uni-graduation',
});
