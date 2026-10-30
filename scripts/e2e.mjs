// Loads dist/ into Playwright's Chromium, walks the popup, plays on-page visits, and
// saves screenshots to e2e-shots/. Fails on any page or extension error.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const shots = join(root, 'e2e-shots');
const dark = process.argv.includes('--dark');
await rm(shots, { recursive: true, force: true });
await mkdir(shots, { recursive: true });

const ARTICLE = (bg, ink) => `<!doctype html><html><head><meta charset="utf-8"><title>Article</title>
<style>body{margin:0;background:${bg};color:${ink};font:18px/1.6 Georgia,serif}main{max-width:640px;margin:48px auto;padding:0 16px}</style></head>
<body><main><h1>An ordinary article</h1>${'<p>Lorem text stands in for a page someone is reading. It keeps going for a while so the page scrolls.</p>'.repeat(12)}</main></body></html>`;
const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(req.url?.startsWith('/dark') ? ARTICLE('#16141c', '#e8e4f0') : ARTICLE('#ffffff', '#222'));
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const errors = [];
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  colorScheme: dark ? 'dark' : 'light',
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const extId = new URL(sw.url()).host;
/** A button a real person can click: fully inside the popup without scrolling, and not covered. */
async function assertReachable(page, selector, label) {
  const ok = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return 'missing';
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return `outside the popup (${Math.round(r.top)}–${Math.round(r.bottom)} of ${innerHeight})`;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el === hit || el.contains(hit) ? 'ok' : 'covered';
  }, selector);
  if (ok !== 'ok') errors.push(`${label} is not reachable: ${ok}`);
}

const shot = async (page, name) => {
  await page.evaluate(() => document.fonts.ready);
  // Popup screens must fit: scrolling is only a safety net, never the design.
  const overflow = await page.evaluate(() => {
    const s = document.querySelector('main#app > .screen');
    return s && s.scrollHeight > s.clientHeight + 1 ? s.scrollHeight - s.clientHeight : 0;
  });
  if (overflow) errors.push(`${name}: popup screen is ${overflow}px taller than the popup`);
  await page.waitForTimeout(50);
  await page.screenshot({ path: join(shots, `${name}.png`) });
};

// ---- popup ----
const popup = await context.newPage();
popup.on('pageerror', (e) => errors.push(`popup: ${e.message}`));
await popup.setViewportSize({ width: 360, height: 600 });
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.waitForSelector('text=Let\'s get acquainted');
await shot(popup, '01-onboarding');
await popup.fill('#ob-you', 'Sara');
await assertReachable(popup, '.screen .bottom .btn-primary', 'Step 1 “Let’s be friends”');
await popup.click('text=Let\'s be friends');
await popup.waitForSelector('text=Step 2 of 2');
await popup.click('[aria-label="Lilac"]');
await popup.click('text=Scarf');
await popup.waitForSelector('[aria-label="Lilac"][aria-pressed="true"]');
await popup.waitForSelector('.seg button[aria-pressed="true"]:has-text("Scarf")');
await shot(popup, '02-pick-look');
await assertReachable(popup, '.screen .bottom .btn-primary', 'Step 2 “I’m ready”');
await popup.click('text=I\'m ready');
await popup.waitForSelector('[role="tablist"]');
// Setup is remembered: reopening the popup goes straight to settings.
await popup.reload();
await popup.waitForSelector('[role="tablist"]', { timeout: 3000 }).catch(() => errors.push('setup not remembered after reopening the popup'));
await shot(popup, '03-settings-look');
const donate = await popup.evaluate(() => {
  const a = document.querySelector('a.bmc');
  return a && { href: a.href, target: a.target };
});
if (donate?.href !== 'https://www.buymeacoffee.com/amirmoqaddasi' || donate.target !== '_blank') {
  errors.push(`donate button wrong: ${JSON.stringify(donate)}`);
}
await assertReachable(popup, 'a.bmc', 'Buy me a coffee');
await popup.click('role=tab[name="Behavior"]');
await shot(popup, '04-settings-behavior');
// Every control on the Behavior tab fits without scrolling.
await assertReachable(popup, '.panel > .card:last-child .btn-chip', 'Names “Edit”');
await assertReachable(popup, '[aria-label="Snooze for 1 hour"]', 'Snooze');
// Cat person / Dog person changes Pip's temperament and shows its traits.
const traitText = () => popup.evaluate(() => [...document.querySelectorAll('.small.muted')].map((e) => e.textContent).find((t) => t.includes(' is ')) ?? '');
if (!(await traitText())) errors.push('Pip’s traits are not shown on the Behavior tab');
await popup.click('text=Dog person');
await popup.waitForTimeout(300);
const temperament = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.temperament);
if (temperament !== 'dog') errors.push(`Dog person did not set the temperament (got ${temperament})`);
await shot(popup, '04b-settings-dog-person');
await popup.click('text=Cat person');
await popup.waitForTimeout(300);
await popup.click('role=tab[name="Look"]');
await popup.click('text=All skins →');
await shot(popup, '05-skins');
// Berry: earned by petting Pip on three different days (recorded by the background).
await popup.click('text=Pet Pip on 3 different days');
await popup.waitForSelector('text=Befriend Pip for Berry');
await shot(popup, '06-berry-progress');
const day = Math.floor(Date.now() / 86_400_000);
await sw.evaluate(async (d) => {
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, pettingDays: [d - 2, d - 1] } });
}, day);
await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'petted' }));
await popup.waitForTimeout(300);
const afterPet = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
if (!afterPet.unlocked.includes('berry') || afterPet.newUnlock !== 'berry') errors.push(`Berry not earned on the third day: ${JSON.stringify({ unlocked: afterPet.unlocked, newUnlock: afterPet.newUnlock })}`);
// The popup celebrates it the next time it opens.
await popup.reload();
await popup.waitForSelector('text=New skin unlocked!');
await shot(popup, '07-unlocked');
await popup.click('text=Keep my current look');
await popup.click('text=All skins →');
await popup.click('text=Share a card');
await popup.waitForSelector('.card-preview img');
await shot(popup, '08-share');

const settings = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
if (!settings.onboarded || settings.userName !== 'Sara' || !settings.unlocked.includes('berry') || 'email' in settings) {
  errors.push(`unexpected settings: ${JSON.stringify(settings)}`);
}

// ---- on-page visits ----
async function visit(path, plan, name, frames) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'warning' && m.text().includes('Pebble') && errors.push(`${name}: ${m.text()}`));
  await page.goto(base + path);
  await page.bringToFront();
  await page.waitForTimeout(300);
  const reply = await sw.evaluate(
    async ({ url, plan }) => {
      const [tab] = await chrome.tabs.query({ url: url + '*' });
      const { settings } = await chrome.storage.local.get('settings');
      return chrome.tabs.sendMessage(tab.id, {
        type: 'visit',
        plan: {
          look: { color: settings.color, accessory: settings.accessory, skin: settings.skin },
          userName: settings.userName,
          petName: settings.petName,
          hello: { before: 'Hi, ', after: '! Just popping by.' },
          ...plan,
        },
      });
    },
    { url: base + path, plan },
  );
  if (!reply?.ok) errors.push(`${name}: visit refused ${JSON.stringify(reply)}`);
  for (const [ms, label] of frames) {
    await page.waitForTimeout(ms);
    await shot(page, `${name}-${label}`);
  }
  return page;
}

const p1 = await visit(
  '/light',
  { kind: 'stay', entrance: 'walk', activity: 'groom', lineKind: 'greeting', speech: 'hello', stalk: false, exit: 'walkAway', side: 'right', spot: 0.85, energy: 0.6, durationMs: 60000, traits: { temperament: 'cat', energy: 0.6, sociability: 1, boldness: 0.6, favoriteSpot: 0.85, favoriteActivity: 'groom' }, bond: 2 },
  '10-visit',
  [[3300, 'a-hello'], [2500, 'b-activity']],
);
// Touch. Pip only reacts when the user starts it; read its pose from the (test-build) open shadow root.
const petInfo = () =>
  p1.evaluate(() => {
    const pet = document.querySelector('pebble-pet')?.shadowRoot?.querySelector('.pet');
    if (!pet) return null;
    const r = pet.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, pose: pet.querySelector('svg')?.getAttribute('aria-label') ?? '' };
  });
const poseSeen = (want, ms) =>
  p1
    .waitForFunction((w) => (document.querySelector('pebble-pet')?.shadowRoot?.querySelector('.pet svg')?.getAttribute('aria-label') ?? '').endsWith(w), want, { timeout: ms, polling: 50 })
    .then(() => true, () => false);

let pet = await petInfo();
if (!pet) errors.push('no pet on the page');
else {
  // Cursor resting near Pip → one slow blink.
  await p1.mouse.move(pet.x - 110, pet.y - 20);
  if (!(await poseSeen('drowsy', 5000))) errors.push('no slow blink when the cursor rested nearby');
  await shot(p1, '10-visit-c-slow-blink');
  await p1.waitForTimeout(2600);

  // Stroking Pip → content, sprout wagging.
  pet = await petInfo();
  for (let i = 0; i < 14; i++) {
    await p1.mouse.move(pet.x - 18 + (i % 2) * 36, pet.y - 10 + (i % 3) * 6, { steps: 3 });
    await p1.waitForTimeout(60);
  }
  if (!(await poseSeen('content', 1000))) errors.push('petting did not make Pip content');
  await shot(p1, '10-visit-d-petted');
  await p1.mouse.move(pet.x - 300, pet.y - 300);
  await p1.waitForTimeout(1800);

  // A click → Pip turns and looks at you.
  pet = await petInfo();
  await p1.mouse.click(pet.x, pet.y);
  if (!(await poseSeen('glance', 800))) errors.push('a click did not make Pip look at the user');
  await shot(p1, '10-visit-e-looks-at-you');
  await p1.waitForTimeout(1600);

  // Too many clicks → an annoyed reaction (bap, hiss, turning away or zoomies).
  pet = await petInfo();
  for (let i = 0; i < 4; i++) {
    await p1.mouse.click(pet.x, pet.y);
    await p1.waitForTimeout(120);
  }
  const annoyed = await p1
    .waitForFunction(
      () => /(swat|hiss|annoyed|walk)$/.test(document.querySelector('pebble-pet')?.shadowRoot?.querySelector('.pet svg')?.getAttribute('aria-label') ?? ''),
      null,
      { timeout: 2000, polling: 50 },
    )
    .then(() => true, () => false);
  if (!annoyed) errors.push('too many clicks did not annoy Pip');
  await shot(p1, '10-visit-f-too-many-clicks');
  await p1.waitForTimeout(9000);

  // Right-click shows the pill; it is otherwise hidden.
  pet = await petInfo();
  await p1.mouse.click(pet.x, pet.y, { button: 'right' });
  await p1.waitForTimeout(300);
  await shot(p1, '10-visit-g-right-click-pill');
  const pillShown = await p1.evaluate(() => document.querySelector('pebble-pet').shadowRoot.querySelector('.controls').classList.contains('show'));
  if (!pillShown) errors.push('right-click did not show the Not now / Snooze pill');
}

// Cat stalking the cursor on arrival: eyes follow it, a tiny pounce, a surprised "missed it".
const pStalk = await context.newPage();
pStalk.on('pageerror', (e) => errors.push(`stalk: ${e.message}`));
await pStalk.goto(base + '/stalk');
await pStalk.bringToFront();
await pStalk.mouse.move(700, 600);
await pStalk.waitForTimeout(300);
await sw.evaluate(async ({ url, traits }) => {
  const [tab] = await chrome.tabs.query({ url: url + '*' });
  await chrome.tabs.sendMessage(tab.id, { type: 'visit', plan: {
    kind: 'stay', entrance: 'walk', activity: 'loaf', lineKind: 'greeting', speech: 'none', stalk: true, exit: 'walkAway', side: 'right', spot: 0.75, energy: 0.6, durationMs: 15000,
    look: { color: '#E8B04B', accessory: 'none', skin: 'plain' }, userName: 'Sara', petName: 'Pip', hello: { before: '', after: '' }, traits, bond: 0,
  } });
}, { url: base + '/stalk', traits: { temperament: 'cat', energy: 0.6, sociability: 0.5, boldness: 0.6, favoriteSpot: 0.75, favoriteActivity: 'loaf' } });
const stalkPose = (want, ms) =>
  pStalk.waitForFunction((w) => (document.querySelector('pebble-pet')?.shadowRoot?.querySelector('.pet svg')?.getAttribute('aria-label') ?? '').endsWith(w), want, { timeout: ms, polling: 50 }).then(() => true, () => false);
if (!(await stalkPose('glance', 6000))) errors.push('stalk: eyes never locked onto the cursor');
const gaze1 = await pStalk.evaluate(() => document.querySelector('pebble-pet').shadowRoot.querySelector('.pp-gaze')?.style.transform);
await pStalk.mouse.move(500, 380, { steps: 8 });
await pStalk.waitForTimeout(400);
const gaze2 = await pStalk.evaluate(() => document.querySelector('pebble-pet').shadowRoot.querySelector('.pp-gaze')?.style.transform);
if (!gaze1 || gaze1 === gaze2) errors.push(`stalk: eyes did not follow the cursor (${gaze1} → ${gaze2})`);
await shot(pStalk, '08b-stalk-eyes');
if (!(await stalkPose('surprised', 6000))) errors.push('stalk: no pounce and surprised landing');
await shot(pStalk, '08c-stalk-missed');
await pStalk.close();

// Passing through: walks across without stopping, then is gone.
const pPass = await visit(
  '/pass',
  { kind: 'pass', entrance: 'walk', activity: 'wander', lineKind: 'greeting', speech: 'none', exit: 'walkAway', side: 'left', spot: 0.5, energy: 0.9, durationMs: 0, traits: { temperament: 'cat', energy: 0.6, sociability: 1, boldness: 0.6, favoriteSpot: 0.85, favoriteActivity: 'groom' }, bond: 2 },
  '09-pass',
  [[2500, 'a-walking']],
);
// Mid-pass Pip must be on screen and moving, not vanish without walking.
const passX = () => pPass.evaluate(() => document.querySelector('pebble-pet')?.shadowRoot?.querySelector('.pet')?.getBoundingClientRect().left ?? null);
const x1 = await passX();
await pPass.waitForTimeout(800);
const x2 = await passX();
if (x1 === null || x2 === null || x1 < 0 || x1 > 1280 || Math.abs(x2 - x1) < 20) errors.push(`pass-through is not walking across the page (x ${x1} → ${x2})`);
const passGone = await pPass
  .waitForFunction(() => !document.querySelector('pebble-pet'), null, { timeout: 30000, polling: 100 })
  .then(() => true, () => false);
if (!passGone) errors.push('a pass-through did not leave the page');
await pPass.close();

const p2 = await visit(
  '/dark',
  { kind: 'stay', entrance: 'peek', activity: 'loaf', lineKind: 'timeOfDay', speech: 'murmur', exit: 'curlUp', side: 'left', spot: 0.15, energy: 0.3, durationMs: 20000, hello: { before: 'mm…', after: '' }, traits: { temperament: 'cat', energy: 0.6, sociability: 1, boldness: 0.6, favoriteSpot: 0.85, favoriteActivity: 'groom' }, bond: 2 },
  '11-dark',
  [[1200, 'a-peek'], [3600, 'b-hello'], [3000, 'c-loaf']],
);
// The test build's 3 s idle timer can start ball play right after, so watch for the removal itself.
const gone = (page, ms) =>
  page.waitForFunction(() => !document.querySelector('pebble-pet'), null, { timeout: ms, polling: 100 }).then(() => true, () => false);
const t0 = Date.now();
p2.on('console', (m) => console.log('[p2]', m.type(), m.text()));
// 20 s visit started ~8 s ago; allow the exit (≤ 9 s guard) and nothing more.
if (!(await gone(p2, 22000))) errors.push('pet host still on page after the visit ended');
console.log('p2 gone after', Date.now() - t0, 'ms');
await shot(p2, '11-dark-d-gone');

// Idle ball play (test build: starts after 3 s without input).
const p3 = await context.newPage();
p3.on('pageerror', (e) => errors.push(`play: ${e.message}`));
await p3.goto(base + '/light');
await p3.bringToFront();
await p3.waitForTimeout(9000);
await shot(p3, '12-ball-play');
if (!(await p3.evaluate(() => !!document.querySelector('pebble-pet')))) errors.push('idle ball play did not start');
await p3.mouse.move(400, 300);
await p3.waitForTimeout(400);
await shot(p3, '12-ball-tucked');
if (!(await gone(p3, 7000))) errors.push('pet stayed after input ended ball play');

// ---- v0.2: gentle, wide petting is recognized (the Berry bug) ----
await sw.evaluate(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, pettingDays: [] } });
});
const traitsAll = { temperament: 'cat', energy: 0.6, sociability: 1, boldness: 0.6, favoriteSpot: 0.85, favoriteActivity: 'loaf' };
const pPet = await visit(
  '/petting',
  { kind: 'stay', entrance: 'walk', activity: 'loaf', lineKind: 'greeting', speech: 'none', stalk: false, exit: 'walkAway', side: 'right', spot: 0.85, energy: 0.6, durationMs: 40000, traits: traitsAll, bond: 0.5 },
  '15-petting',
  [[5000, 'a-arrived']],
);
{
  const info = () => pPet.evaluate(() => {
    const r = document.querySelector('pebble-pet')?.shadowRoot?.querySelector('.pet')?.getBoundingClientRect();
    return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  let at = await info();
  // Slow sweeps that run past Pip's edges: about 1.5–5 px per event at 60 Hz, like a real hand.
  for (let i = 0; i < 12 && at; i++) {
    await pPet.mouse.move(at.x + (i % 2 ? -60 : 60), at.y, { steps: 24 });
  }
  await pPet.mouse.move(10, 10);
  await pPet.waitForTimeout(1500);
  const days = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.pettingDays);
  if (!days?.includes(Math.floor(Date.now() / 86_400_000))) errors.push(`slow, wide petting was not recognized (pettingDays ${JSON.stringify(days)})`);
}
await pPet.close();

// ---- v0.2: a stay keeps changing what it does (no more one activity on repeat) ----
{
  const pVar = await visit(
    '/variety',
    { kind: 'stay', entrance: 'walk', activity: 'scratch', lineKind: 'greeting', speech: 'none', stalk: false, exit: 'walkAway', side: 'left', spot: 0.2, energy: 0.8, durationMs: 32000, traits: { ...traitsAll, energy: 0.8 }, bond: 0.5 },
    '15b-variety',
    [],
  );
  const seen = new Set();
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    const label = await pVar.evaluate(() => document.querySelector('pebble-pet')?.shadowRoot?.querySelector('.pet svg')?.getAttribute('aria-label') ?? '');
    if (label) seen.add(label.split(', ').pop());
    await pVar.waitForTimeout(200);
  }
  if (seen.size < 6) errors.push(`a 30 s stay looked the same: only ${[...seen].join(', ')}`);
  console.log('variety poses:', [...seen].join(', '));
  await pVar.close();
}

// ---- v0.2: characters are skins ----
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.waitForSelector('[role="tablist"]');
await assertReachable(popup, '.skin-tile[aria-label="Pip Vader"]', 'Vader skin tile');
await popup.click('.skin-tile[aria-label="Pip Vader"]');
await popup.waitForSelector('.skin-tile[aria-pressed="true"][aria-label="Pip Vader"]');
await popup.waitForSelector('.pet-name:has-text("Pip Vader")');
await shot(popup, '13-look-vader');
if ((await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.character)) !== 'vader') errors.push('picking the Vader skin did not save the character');
await popup.click('text=All skins →');
await popup.waitForSelector('.gallery-tile[aria-pressed="true"]:has-text("Vader")');
await shot(popup, '13b-skins-with-characters');
// Picking a regular skin goes back to Classic.
await popup.click('.gallery-tile:has-text("Polka")');
await popup.waitForTimeout(300);
if ((await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.character)) !== 'pip') errors.push('picking Polka did not go back to Classic');
await popup.click('.gallery-tile:has-text("Vader")');
await popup.waitForTimeout(300);
await popup.click('[aria-label="Back to settings"]');
await popup.click('role=tab[name="Behavior"]');
if (await popup.isVisible('text=Cat person')) errors.push('a character still shows the Cat/Dog person choice');
if (!(await popup.isVisible('text=own personality'))) errors.push('a character does not explain its own personality');
await shot(popup, '13c-behavior-vader');
await assertReachable(popup, '.panel > .card:last-child .btn-chip', 'Names “Edit” (character)');

// ---- v0.2: water settings ----
await assertReachable(popup, '.unlock-row', 'Water reminders row');
await popup.click('text=Water reminders');
await popup.waitForSelector('h1:has-text("Water")');
await popup.click('[role="switch"][aria-label="Water reminders"]');
await popup.waitForSelector('[role="switch"][aria-label="Water reminders"][aria-checked="true"]');
await popup.click('.seg.every button:has-text("30m")');
await popup.waitForSelector('.seg.every button[aria-pressed="true"]:has-text("30m")');
await popup.click('text=Water only');
await popup.waitForSelector('button[aria-pressed="true"]:has-text("Water only")');
await assertReachable(popup, '.card.tight .btn-chip', '“I drank one”');
await popup.click('text=I drank one');
await popup.waitForSelector('text=1 glass of water');
await shot(popup, '14-water');
{
  const st = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  if (!st.water.on || st.water.everyMin !== 30 || st.mode !== 'water' || st.glasses.count !== 1) errors.push(`water settings not saved: ${JSON.stringify({ water: st.water, mode: st.mode, glasses: st.glasses })}`);
  await popup.waitForTimeout(300);
  const alarm = await sw.evaluate(() => chrome.alarms.get('water'));
  if (!alarm) errors.push('no water alarm after turning reminders on');
}
await popup.click('[aria-label="Back to settings"]');
await popup.waitForSelector('.status:has-text("Water only")').catch(() => errors.push('header does not say Water only'));

// ---- v0.2: each character's own visit ----
const heroVisit = async (character, entrance, activity, exit, name, frames) =>
  visit(
    `/${character}`,
    { kind: 'stay', entrance, activity, lineKind: 'greeting', speech: 'none', stalk: false, exit, side: 'right', spot: 0.8, energy: 0.6, durationMs: 14000, traits: traitsAll, bond: 0.5, look: { color: '#E8B04B', accessory: 'none', skin: 'plain', character } },
    name,
    frames,
  );
const shadowHas = (page, sel, ms) =>
  page.waitForFunction((s) => !!document.querySelector('pebble-pet')?.shadowRoot?.querySelector(s), sel, { timeout: ms, polling: 50 }).then(() => true, () => false);
const poseOn = (page, want, ms) =>
  page.waitForFunction((w) => (document.querySelector('pebble-pet')?.shadowRoot?.querySelector('.pet svg')?.getAttribute('aria-label') ?? '').endsWith(w), want, { timeout: ms, polling: 50 }).then(() => true, () => false);

const pV = await heroVisit('vader', 'march', 'saber', 'walkAway', '16-vader', []);
if (!(await poseOn(pV, 'saber', 12000))) errors.push('Vader never lit his saber');
await shot(pV, '16-vader-saber');
await pV.close();

const pS = await heroVisit('spider', 'webDrop', 'hang', 'webZip', '17-spider', []);
if (!(await shadowHas(pS, '.actor.upside .line.web', 3000))) errors.push('Spider did not drop in upside down on a web');
await shot(pS, '17-spider-drop');
if (!(await poseOn(pS, 'webShoot', 12000))) errors.push('Spider never shot a web to hang from');
await pS.waitForTimeout(1200);
await shot(pS, '17b-spider-hang');
// A click mid-hang interrupts it: Spider must end up back on the floor, right way up, no web.
{
  const r = await pS.evaluate(() => document.querySelector('pebble-pet').shadowRoot.querySelector('.pet').getBoundingClientRect());
  await pS.mouse.click(r.left + r.width / 2, r.top + r.height / 2);
  await pS.waitForTimeout(2500);
  const st = await pS.evaluate(() => {
    const root = document.querySelector('pebble-pet')?.shadowRoot;
    const r = root?.querySelector('.pet')?.getBoundingClientRect();
    return root && { upside: !!root.querySelector('.actor.upside'), line: !!root.querySelector('.line'), bottom: r && Math.round(innerHeight - r.bottom) };
  });
  if (!st || st.upside || st.line || st.bottom > 40) errors.push(`spider stuck after an interrupted hang: ${JSON.stringify(st)}`);
}
await pS.close();

const pB = await heroVisit('bat', 'glide', 'grapple', 'vanish', '18-bat', [[2500, 'a-landed']]);
if (!(await shadowHas(pB, '.line.grapple', 12000))) errors.push('Bat never fired a grapple line');
await shot(pB, '18b-bat-grapple');
await pB.close();

// ---- v0.2: the water reminder ----
const water = async (character, name) => {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(base + `/${name}`);
  await page.bringToFront();
  await page.waitForTimeout(300);
  const reply = await sw.evaluate(
    async ({ url, character, traits }) => {
      const [tab] = await chrome.tabs.query({ url: url + '*' });
      return chrome.tabs.sendMessage(tab.id, {
        type: 'water',
        plan: {
          look: { color: '#E8B04B', accessory: 'none', skin: 'plain', character },
          petName: 'Pip', userName: 'Sara', traits, side: 'right',
          line: { before: 'I find your lack of water… disturbing.', after: '', named: false },
          drank: { before: 'Yay!', after: '', named: false },
        },
      });
    },
    { url: base + `/${name}`, character, traits: traitsAll },
  );
  if (!reply?.ok) errors.push(`${name}: water reminder refused ${JSON.stringify(reply)}`);
  if (!(await shadowHas(page, '.bubble.asking .actions button.primary', 9000))) errors.push(`${name}: no Done/Later bubble`);
  return page;
};
const glasses = () => sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.glasses.count);
for (const [character, name] of [['vader', '19-water-vader'], ['spider', '20-water-spider']]) {
  const page = await water(character, name);
  await shot(page, name);
  const before = await glasses();
  await page.locator('pebble-pet .bubble .actions button.primary').click();
  await page.waitForTimeout(600);
  await shot(page, `${name}-b-drank`);
  if ((await glasses()) !== before + 1) errors.push(`${name}: “Done, I drank” did not add a glass`);
  if (!(await gone(page, 12000))) errors.push(`${name}: did not leave after drinking`);
  await page.close();
}
{
  const page = await water('bat', '21-water-bat');
  await shot(page, '21-water-bat');
  await page.locator('pebble-pet .bubble .actions button:not(.primary)').click();
  await page.waitForTimeout(500);
  const alarm = await sw.evaluate(() => chrome.alarms.get('water'));
  const inMin = alarm ? (alarm.scheduledTime - Date.now()) / 60000 : -1;
  if (inMin < 13 || inMin > 16) errors.push(`“Later” should ask again in 15 minutes (alarm in ${inMin.toFixed(1)} min)`);
  if (!(await gone(page, 12000))) errors.push('bat water: did not leave after Later');
  await page.close();
}

// Water-only mode: no idle ball play.
const p4 = await context.newPage();
await p4.goto(base + '/water-only');
await p4.bringToFront();
await p4.waitForTimeout(9000);
if (await p4.evaluate(() => !!document.querySelector('pebble-pet'))) errors.push('ball play started in Water-only mode');
await p4.close();

server.close();
await context.close();
if (errors.length) {
  console.error('E2E FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`E2E passed. Screenshots in ${shots}`);
