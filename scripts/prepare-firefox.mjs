import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const outDir = resolve(rootDir, 'dist', 'firefox');

const FILES = [
  'LICENSE',
  'dashboard.css',
  'dashboard.html',
  'dashboard.js',
  'data.js',
  'manifest.json',
  'popup.css',
  'popup.html',
  'popup.js',
  'styles.css',
  'ui.js'
];

const GECKO_ID = 'curiogems@pixelff.com';

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const relativePath of FILES) {
  await cp(resolve(rootDir, relativePath), resolve(outDir, relativePath));
}
await cp(resolve(rootDir, 'icons'), resolve(outDir, 'icons'), { recursive: true });

const manifestPath = resolve(outDir, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) {
  throw new Error(`Expected Manifest V3, got ${manifest.manifest_version}`);
}
if (JSON.stringify(manifest.permissions ?? []) !== JSON.stringify(['storage'])) {
  throw new Error('Firefox package must request only the storage permission.');
}
if (manifest.host_permissions || manifest.content_scripts) {
  throw new Error('Firefox package unexpectedly contains host permissions or content scripts.');
}

manifest.browser_specific_settings = {
  gecko: {
    id: GECKO_ID,
    data_collection_permissions: {
      required: ['none']
    }
  }
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Prepared Firefox source: ${outDir}`);
console.log(`Firefox add-on ID: ${GECKO_ID}`);
