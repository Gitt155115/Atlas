import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project below /Atlas/; local dev remains at /.
  base: command === 'build' ? '/Atlas/' : '/',
  plugins: [react()],
  oxc: { jsx: { runtime: 'automatic' } },
}));
