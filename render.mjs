// Renders meme.html to a 1024x1024 PNG via the puppeteer-bundled Chromium
// (stock Chromium refuses to start on this VM; /opt/meta-chromium/chrome is unusable).
//   node render.mjs [out.png]   (default: meme.png)
// Deterministic: local file only; fails loudly if any non-file request happens
// or if the page content overflows the 1024x1024 frame.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire('/home/hatch/workspace/makefun/screenshot-tool/package.json');
const puppeteer = require('puppeteer');

const out = resolve(process.argv[2] || 'meme.png');
const html = resolve('meme.html');

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));
const external = [];
page.on('request', (req) => {
  const u = req.url();
  if (!u.startsWith('file://') && !u.startsWith('data:')) external.push(u);
});
await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 300));
const overflow = await page.evaluate(() => {
  const el = document.documentElement;
  return { scrollW: el.scrollWidth, scrollH: el.scrollHeight, clientW: el.clientWidth, clientH: el.clientHeight };
});
console.log('overflow check:', JSON.stringify(overflow));
if (overflow.scrollH > 1024 || overflow.scrollW > 1024) {
  console.error('OVERFLOW: content exceeds 1024x1024');
  process.exitCode = 2;
}
await page.screenshot({ path: out });
await browser.close();
if (external.length) {
  console.error('EXTERNAL REQUESTS:', external);
  process.exitCode = 3;
} else {
  console.log('no external requests');
}
console.log('rendered', out);
