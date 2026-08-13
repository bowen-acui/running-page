import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Post-build smoke test for CI: the react/react-dom version-mismatch incident
// (React error #527) shipped a blank page while every build-time check was
// green. This loads the built site in a real headless browser and fails the
// deploy if the app does not actually render.

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(rootDir, 'dist');
const basePath = process.env.SMOKE_BASE_PATH || '/running-page';
const require = createRequire(import.meta.url);

const fail = (message) => {
  console.error(`smoke-test: FAIL — ${message}`);
  process.exit(1);
};

// 1. react and react-dom must resolve to the exact same version.
const reactVersion = require('react/package.json').version;
const reactDomVersion = require('react-dom/package.json').version;
if (reactVersion !== reactDomVersion) {
  fail(
    `react@${reactVersion} != react-dom@${reactDomVersion} — this mismatch crashes at runtime (React error #527)`
  );
}
console.log(`smoke-test: react/react-dom versions match (${reactVersion})`);

// 2. Serve dist/ the way GitHub Pages does (static files under basePath).
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.startsWith(basePath)) path = path.slice(basePath.length);
    if (path === '' || path === '/') path = '/index.html';
    const file = await readFile(join(distDir, path));
    res.writeHead(200, {
      'Content-Type': MIME[extname(path)] || 'application/octet-stream',
    });
    res.end(file);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const { port } = server.address();
const url = `http://127.0.0.1:${port}${basePath}/`;

// 3. Load the page in headless Chromium and require a rendered app.
const { chromium } = await import('playwright');
const browser = await chromium.launch({
  // CI installs the matching browser; local runs may point at any Chromium.
  executablePath: process.env.SMOKE_CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
try {
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root && root.children.length > 0 && root.innerText.length > 50;
    },
    { timeout: 30000 }
  );
} catch {
  await browser.close();
  server.close();
  fail(
    `#root never rendered content${pageErrors.length ? ` — page errors: ${pageErrors.join(' | ')}` : ''}`
  );
}

await browser.close();
server.close();

if (pageErrors.length) {
  fail(`page errors thrown during load: ${pageErrors.join(' | ')}`);
}

console.log('smoke-test: PASS — app rendered without page errors');
