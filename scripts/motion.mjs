// Motion checks for the e2e build: "Call Pip over" with the popup focused, and a
// per-frame trace of Pip's position during a hop entrance + dance.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const videoDir = join(root, 'e2e-shots', 'video');
await mkdir(videoDir, { recursive: true });
const server = createServer((_q, r) => {
  r.writeHead(200, { 'content-type': 'text/html' });
  r.end('<!doctype html><body style="margin:0;font:18px Georgia"><main style="max-width:640px;margin:48px auto">' + '<p>Reading along.</p>'.repeat(30) + '</main></body>');
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
const errors = [];
const headed = process.argv.includes('--headed');
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: !headed,
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, ...(headed ? ['--window-position=-2400,-2400'] : [])],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
await sw.evaluate(() => chrome.storage.local.set({ settings: { onboarded: true, userName: 'Sara', petName: 'Pip' } }));
const page = await ctx.newPage();
await page.goto(url);
await page.bringToFront();
await page.waitForTimeout(400);

// 1) "Call Pip over" from the real toolbar popup (headed run only: needs a real window).
if (headed) {
  await sw.evaluate(() => chrome.storage.local.set({ e2eVisitNow: true, e2eVisitNowReply: null }));
  await sw.evaluate(() => chrome.action.openPopup());
  let reply = null;
  for (let i = 0; i < 30 && !reply; i++) {
    await new Promise((r) => setTimeout(r, 100));
    reply = await sw.evaluate(async () => (await chrome.storage.local.get('e2eVisitNowReply')).e2eVisitNowReply);
  }
  const appeared = await page.waitForFunction(() => !!document.querySelector('pebble-pet'), null, { timeout: 3000 }).then(() => true, () => false);
  console.log('visitNow from toolbar popup:', JSON.stringify(reply), 'pet appeared:', appeared);
  if (!reply?.ok || !appeared) errors.push('Call Pip over from the toolbar popup did not bring Pip');
  await page.waitForFunction(() => !document.querySelector('pebble-pet'), null, { timeout: 150000, polling: 250 }).catch(() => {});
}

// 2) Motion trace.
await page.bringToFront();
await sw.evaluate(async (u) => {
  const [tab] = await chrome.tabs.query({ url: u + '*' });
  await chrome.tabs.sendMessage(tab.id, {
    type: 'visit',
    plan: {
      look: { color: '#FFB38A', accessory: 'none', skin: 'plain' }, userName: 'Sara', petName: 'Pip',
      hello: { before: 'Hi, ', after: '!' },
      kind: 'stay', entrance: 'saunter', activity: 'wander', lineKind: 'greeting', speech: 'none', exit: 'walkAway', side: 'right', spot: 0.8, energy: 0.6, durationMs: 20000, traits: { temperament: 'cat', energy: 0.6, sociability: 1, boldness: 0.6, favoriteSpot: 0.85, favoriteActivity: 'groom' }, bond: 2,
    },
  });
}, url);
const trace = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const pts = [];
      const t0 = performance.now();
      const tick = (t) => {
        const pet = document.querySelector('pebble-pet')?.shadowRoot?.querySelector('.pet');
        if (pet) {
          const r = pet.getBoundingClientRect();
          pts.push([t - t0, r.left, r.top]);
        }
        if (t - t0 < 11000) requestAnimationFrame(tick);
        else resolve(pts);
      };
      requestAnimationFrame(tick);
    }),
);
let maxStep = 0, maxJerk = 0, kinks = 0, gaps = 0;
for (let i = 2; i < trace.length; i++) {
  const [t, x, y] = trace[i], [t1, x1, y1] = trace[i - 1], [, x2, y2] = trace[i - 2];
  maxStep = Math.max(maxStep, Math.hypot(x - x1, y - y1));
  const ddx = (x - x1) - (x1 - x2), ddy = (y - y1) - (y1 - y2);
  const j = Math.hypot(ddx, ddy);
  maxJerk = Math.max(maxJerk, j);
  if (j > 2.5) { kinks++; if (process.argv.includes('--why')) console.log('kink t=' + t.toFixed(0) + 'ms d1=(' + (x1 - x2).toFixed(1) + ',' + (y1 - y2).toFixed(1) + ') d2=(' + (x - x1).toFixed(1) + ',' + (y - y1).toFixed(1) + ')'); }
  if (t - t1 > 40) gaps++;
}
console.log(JSON.stringify({ frames: trace.length, maxStepPx: +maxStep.toFixed(1), maxAccelPx: +maxJerk.toFixed(2), kinks, longFrames: gaps }));
if (maxStep > 40) errors.push(`pet jumped ${maxStep.toFixed(0)}px in one frame`);
await ctx.close();
server.close();
if (errors.length) {
  console.error('MOTION FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('MOTION passed. Video in ' + videoDir);
