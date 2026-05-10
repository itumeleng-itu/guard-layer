import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * GuardLayer dashboard dev server. `/api` is proxied to the middleware so the
 * browser stays same-origin (SSE + activity fetch). Override with
 * `MIDDLEWARE_PROXY_URL` in `.env.local` if the API listens elsewhere.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const target = (
    env.MIDDLEWARE_PROXY_URL ||
    env.VITE_MIDDLEWARE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});
