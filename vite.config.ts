import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// The SPA is served by the Express API in production (same origin, relative /api calls).
// In development Vite proxies /api to the API server so the browser never calls localhost directly.
export default defineConfig({
  root: resolve(__dirname, 'web'),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/web'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
