import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(here, '..');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

/* Serves the existing static site from Edu-frontend/ at the root, so it and the
   React routes under /app share one origin — and therefore one localStorage. */
function existingSite() {
  return {
    name: 'existing-site',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent(req.url.split('?')[0]);
        if (url.startsWith('/app') || url.startsWith('/@') || url.startsWith('/src') ||
            url.startsWith('/node_modules') || url.startsWith('/__')) return next();

        const file = path.join(siteDir, url === '/' ? 'index.html' : url.slice(1));
        if (!file.startsWith(siteDir) || file.startsWith(here)) return next();
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();

        res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
        res.end(fs.readFileSync(file));
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  /* dev serves this under /app/ next to the static site; the production build is
     its own Vercel project, deployed at that domain's root. */
  base: command === 'build' ? '/' : '/app/',
  plugins: [existingSite(), react()],
  /* bind both 127.0.0.1 and ::1, so either spelling of localhost works */
  server: { port: 5175, host: true },
}));
