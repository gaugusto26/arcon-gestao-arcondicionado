import { defineConfig } from 'vite';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/arcon-gestao-arcondicionado/' : '/',
  resolve: {
    alias: {
      '@': `${__dirname}/src`
    }
  }
});