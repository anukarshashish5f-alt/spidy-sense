import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages serves this repository from /spidy-sense/.
// Local development and other root-hosted deployments use /.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/spidy-sense/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
