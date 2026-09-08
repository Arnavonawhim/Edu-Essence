/* Assembles all three frontends into one dist/ for a single Vercel project:
     dist/            <- Edu-frontend static site (index.html, tutor.html, ...)
     dist/app/        <- react-sample  (vite base '/app/')
     dist/translator/ <- translator-page (vite base '/translator/')

   One origin means one localStorage, which is what react-sample's auth assumes. */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
/* Run through a shell: on Windows npm is a .cmd that Node won't spawn directly. */
const npm = 'npm';

/* Not part of the deployed static site: build inputs and the sub-app we build separately. */
const SKIP = new Set([
  'node_modules', 'package.json', 'package-lock.json',
  'react-sample', 'dist', '.DS_Store', '.gitignore',
]);

function run(command, cwd) {
  console.log(`> ${command}  [${path.relative(root, cwd) || '.'}]`);
  /* one string + shell:true, so no unescaped args reach the shell */
  execSync(command, { cwd, stdio: 'inherit' });
}

function buildViteApp(rel) {
  const abs = path.join(root, rel);
  try {
    run(`${npm} ci`, abs);
  } catch {
    /* lockfile out of sync with package.json — don't fail the deploy over it */
    console.log(`  npm ci failed in ${rel}, falling back to npm install`);
    run(`${npm} install`, abs);
  }
  run(`${npm} run build`, abs);

  const out = path.join(abs, 'dist');
  if (!fs.existsSync(out)) throw new Error(`${rel} build produced no dist/`);
  return out;
}

console.log('\n=== EduEssence unified build ===\n');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 1. Static site at the root
const staticDir = path.join(root, 'Edu-frontend');
for (const entry of fs.readdirSync(staticDir)) {
  if (SKIP.has(entry)) continue;
  fs.cpSync(path.join(staticDir, entry), path.join(dist, entry), { recursive: true });
}
console.log('copied Edu-frontend -> dist/\n');

// 2. Online classroom at /app/
fs.cpSync(buildViteApp('Edu-frontend/react-sample'), path.join(dist, 'app'), { recursive: true });
console.log('copied react-sample -> dist/app/\n');

// 3. Translator at /translator/
fs.cpSync(buildViteApp('translator-page'), path.join(dist, 'translator'), { recursive: true });
console.log('copied translator-page -> dist/translator/\n');

console.log('=== build complete ===');
