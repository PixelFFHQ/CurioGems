import assert from 'node:assert/strict';
import {
  buildXUrl,
  canonicalItemKey,
  createStarterData,
  exportPayload,
  loadData,
  mergeData,
  normalizeHandle,
  normalizeHashtag,
  parseImportPayload,
  parseXProfileUrl,
  openXItem,
  previewMerge,
  reorderWithinCategory,
  validateData,
  validateHandle,
  validateHashtag
} from '../data.js';

const starter = createStarterData();
assert.equal(validateData(starter).valid, true, 'starter data should validate');
assert.equal(starter.categories.length, 3, 'starter should have three categories');
assert.equal(starter.items.length, 6, 'starter should have six entries');
assert.equal(starter.items.filter(i => i.type === 'person').length, 0, 'starter should not preload people');

assert.equal(normalizeHashtag('##AmWriting'), '#AmWriting');
assert.equal(validateHashtag('#AmWriting'), '');
assert.notEqual(validateHashtag('#two words'), '');
assert.equal(normalizeHandle('@SomeAuthor'), 'SomeAuthor');
assert.equal(normalizeHandle('https://x.com/SomeAuthor'), 'SomeAuthor');
assert.equal(validateHandle('@SomeAuthor'), '');
assert.notEqual(validateHandle('@this_handle_is_way_too_long'), '');

assert.deepEqual(parseXProfileUrl('https://x.com/SomeAuthor'), { valid: true, handle: 'SomeAuthor', error: '' });
assert.deepEqual(parseXProfileUrl('x.com/SomeAuthor?lang=en'), { valid: true, handle: 'SomeAuthor', error: '' });
assert.equal(parseXProfileUrl('https://twitter.com/SomeAuthor/').valid, true);
assert.equal(parseXProfileUrl('https://x.com/SomeAuthor/status/123').valid, false, 'post URLs must not be treated as profiles');
assert.equal(parseXProfileUrl('https://x.com/search?q=writers').valid, false, 'X search URLs must not be treated as profiles');
assert.equal(parseXProfileUrl('https://example.com/SomeAuthor').valid, false, 'non-X URLs must be rejected');

const tagUrl = buildXUrl({ type: 'hashtag', hashtag: '#AmWriting' });
assert.equal(tagUrl, 'https://x.com/search?q=%23AmWriting&f=live');
const queryUrl = buildXUrl({ type: 'search', query: '("creative tools" OR "browser extension") useful' });
assert.equal(queryUrl, 'https://x.com/search?q=(%22creative%20tools%22%20OR%20%22browser%20extension%22)%20useful&f=live');
const personUrl = buildXUrl({ type: 'person', handle: '@SomeAuthor' });
assert.equal(personUrl, 'https://x.com/SomeAuthor');

const payload = exportPayload(starter);
assert.equal(payload.app, 'CurioGems', 'exports should use the CurioGems app label');
const roundTrip = parseImportPayload(JSON.stringify(payload));
assert.equal(roundTrip.valid, true, 'export should import cleanly');
assert.equal(roundTrip.data.items.length, starter.items.length);
assert.equal(parseImportPayload('{ nope').valid, false, 'malformed JSON should be rejected');

const legacyWriterRadarBackup = { ...payload, app: 'Writer Radar', appVersion: '1.0.3' };
assert.equal(parseImportPayload(JSON.stringify(legacyWriterRadarBackup)).valid, true, 'legacy Writer Radar backups should remain importable');

const incoming = structuredClone(starter);
const community = incoming.categories.find(c => c.name === 'Community');
incoming.items.push({
  ...incoming.items[0],
  id: 'item_new_unique',
  type: 'search',
  displayName: 'Unique query',
  query: 'unique curiogems query',
  categoryId: community.id,
  order: 99
});
const preview = previewMerge(starter, incoming);
assert.equal(preview.addedItems, 1, 'merge preview should identify one new item');
assert.equal(preview.duplicateItems, starter.items.length, 'merge preview should skip duplicate starter items');
const merged = mergeData(starter, incoming);
assert.equal(merged.items.length, starter.items.length + 1, 'merge should add only unique item');
assert.equal(new Set(merged.items.map(canonicalItemKey)).size, merged.items.length, 'merged items should remain unique by canonical key');
assert.equal(validateData(merged).valid, true, 'merged data should validate');



// Mock Chromium APIs to verify first-run initialization and ordinary-tab navigation.
let storageState = {};
let setCalls = 0;
let createdTabs = [];
let updatedTabs = [];
globalThis.chrome = {
  storage: {
    local: {
      async get(key) { return Object.prototype.hasOwnProperty.call(storageState, key) ? { [key]: storageState[key] } : {}; },
      async set(value) { setCalls += 1; Object.assign(storageState, structuredClone(value)); }
    }
  },
  tabs: {
    async create(options) { createdTabs.push(options); return {}; },
    async update(options) { updatedTabs.push(options); return {}; }
  }
};

const firstLoad = await loadData();
assert.equal(setCalls, 1, 'first load should initialize storage once');
firstLoad.items[0].note = 'keep me';
storageState.writerRadarData = structuredClone(firstLoad);
const secondLoad = await loadData();
assert.equal(setCalls, 1, 'existing valid data must not be overwritten during load');
assert.equal(secondLoad.items[0].note, 'keep me', 'existing data should survive reload');

const openNew = structuredClone(secondLoad);
openNew.settings.openMode = 'new';
const openedTag = openNew.items.find(i => i.type === 'hashtag');
await openXItem(openNew, openedTag.id);
assert.equal(createdTabs.at(-1).url, buildXUrl(openedTag), 'new-tab mode should open the expected official X URL');

const openCurrent = structuredClone(secondLoad);
openCurrent.settings.openMode = 'current';
const openedSearch = openCurrent.items.find(i => i.type === 'search');
await openXItem(openCurrent, openedSearch.id);
assert.equal(updatedTabs.at(-1).url, buildXUrl(openedSearch), 'current-tab mode should navigate to the expected official X URL');

const reorderSample = structuredClone(secondLoad);
const sameCategory = reorderSample.items.filter(i => i.categoryId === reorderSample.items[0].categoryId).sort((a,b) => a.order - b.order);
if (sameCategory.length >= 2) {
  const firstId = sameCategory[0].id;
  const secondId = sameCategory[1].id;
  reorderWithinCategory(reorderSample, secondId, 'up');
  const reordered = reorderSample.items.filter(i => i.categoryId === sameCategory[0].categoryId).sort((a,b) => a.order - b.order);
  assert.equal(reordered[0].id, secondId, 'move-up should reorder entries within a category');
  assert.equal(reordered[1].id, firstId, 'move-up should swap with the previous entry');
}

console.log('CurioGems tests passed.');

// Static integration checks for popup Quick Add and the minimal manifest surface.
const { readFile, access } = await import('node:fs/promises');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const testDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(testDir, '..');
const popupHtml = await readFile(resolve(rootDir, 'popup.html'), 'utf8');
const popupJs = await readFile(resolve(rootDir, 'popup.js'), 'utf8');
const popupCss = await readFile(resolve(rootDir, 'popup.css'), 'utf8');
const manifest = JSON.parse(await readFile(resolve(rootDir, 'manifest.json'), 'utf8'));

for (const id of [
  'quickAddDialog', 'quickAddForm', 'quickHashtagInput', 'quickSearchNameInput',
  'quickSearchQueryInput', 'quickPersonProfileUrlInput', 'quickPersonHandleInput',
  'quickItemCategory', 'quickItemFavorite', 'quickItemNote', 'quickAddError'
]) {
  assert.match(popupHtml, new RegExp(`id=["']${id}["']`), `popup should contain #${id}`);
  assert.match(popupJs, new RegExp(id), `popup JS should wire #${id}`);
}
assert.doesNotMatch(popupJs, /openDashboard\(['"]\?add=1/, 'popup Add must not launch the dashboard add route');
assert.deepEqual(manifest.permissions, ['storage'], 'v1.1.1 should keep only storage permission');
assert.equal(manifest.host_permissions, undefined, 'v1.1.1 should not request host permissions');
assert.equal(manifest.content_scripts, undefined, 'v1.1.1 should not inject content scripts');
assert.equal(manifest.version, '1.1.1');
assert.equal(manifest.name, 'CurioGems');

for (const relativePath of [
  manifest.action.default_popup,
  ...Object.values(manifest.action.default_icon || {}),
  ...Object.values(manifest.icons || {})
]) {
  await access(resolve(rootDir, relativePath));
}

assert.match(popupCss, /\.popup-content\s*\{[^}]*overflow-x:\s*hidden/s, 'popup content should suppress horizontal scrolling');
assert.match(popupCss, /\.popup-item \.item-main\s*\{[^}]*display:\s*flex[^}]*gap:\s*6px/s, 'popup item text should have visible spacing');
assert.match(popupCss, /\.popup-item \.item-subtitle\s*\{[^}]*flex:\s*1 1 0/s, 'popup secondary text should yield space before the title');
assert.match(popupJs, /title:\s*secondaryText/, 'popup should preserve full secondary text in a hover tooltip');
