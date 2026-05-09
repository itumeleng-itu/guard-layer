import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the GuardLayer P4 dashboard. The /api proxy mirrors the
 * middleware default port so the SSE consumer can POST through dev origin.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
