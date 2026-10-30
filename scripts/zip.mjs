// Packs dist/ into a zip ready to upload to the Chrome Web Store.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'dist/manifest.json'), 'utf8'));
const out = join(root, `pebble-${version}.zip`);
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', out, '.'], { cwd: join(root, 'dist'), stdio: 'inherit' });
console.log(`\nCreated ${out}`);
