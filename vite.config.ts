import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const pagesBase = process.env.PAGES_CUSTOM_DOMAIN === 'true' ? '/' : '/presente-casamento-web/';
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? pagesBase : '/',
  plugins: [react()],
  server: { port: 5173 },
});
