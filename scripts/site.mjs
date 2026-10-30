// Builds the Netlify site into site/ from site-src/: the landing page (with Pip drawn by the
// extension's own pet code, so the character always matches) and the privacy policy.
import * as esbuild from 'esbuild';
import { Resvg } from '@resvg/resvg-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site');

async function load(entry) {
  const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', write: false, platform: 'neutral' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const { petSvg } = await load('src/shared/pet.ts');
const { BUTTERFLY } = await load('src/content/props.ts');
const config = await load('src/shared/config.ts');

const COFFEE =
  '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block"><path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" fill="#FFDD00" stroke="#000" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="#000" stroke-width="1.8"/></svg>';

/** "Add to Chrome" once the store link is set in src/shared/config.ts; a clear "coming soon" until then. */
function cta() {
  const chrome =
    '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>';
  return config.STORE_URL
    ? `<a class="cta" href="${config.STORE_URL}" target="_blank" rel="noopener">${chrome} Add to Chrome — it's free</a>`
    : `<span class="cta" aria-disabled="true" role="link">${chrome} Coming soon to Chrome</span>`;
}

/** {{pet pose=walk size=72 color=#hex acc=hat skin=cloud flip label="…"}} → inline SVG. */
function pet(args) {
  const opt = {};
  for (const m of args.matchAll(/(\w+)(?:=("[^"]*"|\S+))?/g)) opt[m[1]] = m[2] === undefined ? true : m[2].replace(/^"|"$/g, '');
  return petSvg({
    pose: opt.pose ?? 'idle',
    size: Number(opt.size ?? 120),
    color: opt.color,
    accessory: opt.acc,
    skin: opt.skin,
    flip: !!opt.flip,
    label: opt.label,
  }).replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"');
}

const fill = (html) =>
  html
    .replace(/\{\{pet ([^}]*)\}\}/g, (_, a) => pet(a))
    .replaceAll('{{butterfly}}', BUTTERFLY.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"'))
    .replaceAll('{{cta}}', cta())
    .replaceAll('{{coffee}}', COFFEE)
    .replaceAll('{{DONATE_URL}}', config.DONATE_URL)
    .replaceAll('{{PRIVACY_URL}}', config.PRIVACY_URL)
    .replaceAll('{{SITE_URL}}', config.SHARE_URL)
    .replaceAll('{{CONTACT_EMAIL}}', config.CONTACT_EMAIL);

await mkdir(join(out, 'privacy'), { recursive: true });
await writeFile(join(out, 'index.html'), fill(await readFile(join(root, 'site-src/index.html'), 'utf8')));
await writeFile(join(out, 'privacy/index.html'), fill(await readFile(join(root, 'site-src/privacy.html'), 'utf8')));
// Favicon: Pip itself.
const icon = petSvg({ pose: 'idle', size: 120 });
await writeFile(join(out, 'icon.png'), new Resvg(icon, { fitTo: { mode: 'width', value: 64 } }).render().asPng());
// The privacy policy is also its own Netlify site (PRIVACY_URL): same page at the root.
const privacyOut = join(root, 'privacy-site');
await mkdir(privacyOut, { recursive: true });
await writeFile(join(privacyOut, 'index.html'), fill(await readFile(join(root, 'site-src/privacy.html'), 'utf8')));

// One file per Netlify site to upload (Deploys → drag and drop), so nothing gets left out.
const { execFileSync } = await import('node:child_process');
const fs = await import('node:fs');
for (const [dir, zip] of [[out, 'pebble-site.zip'], [privacyOut, 'pebble-privacy-site.zip']]) {
  fs.rmSync(join(root, zip), { force: true });
  execFileSync('zip', ['-r', '-X', '-q', join(root, zip), '.'], { cwd: dir });
}
console.log(`Sites built: pebble-site.zip (landing) and pebble-privacy-site.zip (privacy)${config.STORE_URL ? '' : ' (store link not set yet: button shows "Coming soon")'}`);
