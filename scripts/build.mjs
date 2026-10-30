// Bundles the extension into dist/: scripts via esbuild, static files, fonts and icons.
import * as esbuild from 'esbuild';
import { Resvg } from '@resvg/resvg-js';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const watch = process.argv.includes('--watch');
const test = process.argv.includes('--test');

const FONTS = {
  'fredoka-600.woff2': '@fontsource/fredoka/files/fredoka-latin-600-normal.woff2',
  'nunito-400.woff2': '@fontsource/nunito/files/nunito-latin-400-normal.woff2',
  'nunito-700.woff2': '@fontsource/nunito/files/nunito-latin-700-normal.woff2',
  'nunito-800.woff2': '@fontsource/nunito/files/nunito-latin-800-normal.woff2',
};

async function copyStatic() {
  await cp(join(root, 'static'), dist, { recursive: true });
  await mkdir(join(dist, 'fonts'), { recursive: true });
  for (const [out, src] of Object.entries(FONTS)) {
    await cp(join(root, 'node_modules', src), join(dist, 'fonts', out));
  }
}

/** Renders the toolbar/store icons from the same pet drawing the extension uses. */
async function buildIcons() {
  const out = await esbuild.build({
    entryPoints: [join(root, 'src/shared/pet.ts')],
    bundle: true,
    format: 'esm',
    write: false,
    platform: 'neutral',
  });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
  await mkdir(join(dist, 'icons'), { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    // Small sizes drop the shadow-y details by drawing a touch larger than the canvas.
    const pet = mod.petSvg({ pose: 'idle', size: 120 });
    const pad = size <= 32 ? -6 : 0;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${pad} ${pad + 4} ${120 - 2 * pad} ${120 - 2 * pad}" width="${size}" height="${size}">${pet}</svg>`;
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
    await writeFile(join(dist, 'icons', `icon-${size}.png`), png);
  }
}

const common = {
  bundle: true,
  target: 'chrome116',
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  legalComments: 'none',
  define: { __TEST__: String(test) },
};

const entries = [
  { entryPoints: [join(root, 'src/background/index.ts')], outfile: join(dist, 'background.js'), format: 'esm' },
  { entryPoints: [join(root, 'src/content/index.ts')], outfile: join(dist, 'content.js'), format: 'iife' },
  { entryPoints: [join(root, 'src/popup/index.ts')], outfile: join(dist, 'popup.js'), format: 'iife' },
];

await rm(dist, { recursive: true, force: true });
await copyStatic();
await buildIcons();

if (watch) {
  for (const e of entries) {
    const ctx = await esbuild.context({ ...common, ...e });
    await ctx.watch();
  }
  console.log('Watching for changes. Reload the extension in chrome://extensions after edits.');
} else {
  await Promise.all(entries.map((e) => esbuild.build({ ...common, ...e })));
}
