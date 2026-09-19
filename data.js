// Kept for in-place upgrades from Writer Radar so existing local data survives the rebrand.
export const STORAGE_KEY = 'writerRadarData';
export const APP_VERSION = '1.1.1';
export const SCHEMA_VERSION = 1;

const STARTER_CATEGORY_DEFS = [
  { name: 'Community', icon: '✦', color: '#55cbd3' },
  { name: 'Research', icon: '⌁', color: '#d46fb7' },
  { name: 'People', icon: '@', color: '#78b7ff' }
];

function randomId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createId(prefix) {
  return randomId(prefix);
}

export function createStarterData() {
  const now = new Date().toISOString();
  const categories = STARTER_CATEGORY_DEFS.map((c, index) => ({
    id: randomId('cat'),
    name: c.name,
    icon: c.icon,
    color: c.color,
    order: index,
    collapsed: false,
    createdAt: now,
    updatedAt: now
  }));
  const byName = Object.fromEntries(categories.map(c => [c.name, c.id]));
  const items = [];

  const addHashtag = (tag, category, order) => items.push({
    id: randomId('item'), type: 'hashtag', hashtag: tag, categoryId: byName[category], note: '', favorite: false,
    order, useCount: 0, lastUsed: null, createdAt: now, updatedAt: now
  });
  const addSearch = (displayName, query, category, order) => items.push({
    id: randomId('item'), type: 'search', displayName, query, categoryId: byName[category], note: '', favorite: false,
    order, useCount: 0, lastUsed: null, createdAt: now, updatedAt: now
  });

  addHashtag('#WritingCommunity', 'Community', 0);
  addHashtag('#IndieDev', 'Community', 1);
  addHashtag('#3DPrinting', 'Community', 2);
  addSearch('Creative tools', '"creative tools"', 'Research', 0);
  addSearch('Browser extensions', '"browser extension"', 'Research', 1);
  addSearch('Local-first software', '"local first" software', 'Research', 2);

  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    initialized: true,
    settings: { openMode: 'new' },
    categories,
    items,
    createdAt: now,
    updatedAt: now
  };
}

export async function loadData() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (result[STORAGE_KEY] === undefined) {
    const starter = createStarterData();
    await chrome.storage.local.set({ [STORAGE_KEY]: starter });
    return starter;
  }

  const validation = validateData(result[STORAGE_KEY]);
  if (!validation.valid) {
    throw new Error(`Stored CurioGems data is invalid: ${validation.errors.join('; ')}`);
  }
  return normalizeData(result[STORAGE_KEY]);
}

export async function saveData(data) {
  const normalized = normalizeData({ ...data, updatedAt: new Date().toISOString() });
  const validation = validateData(normalized);
  if (!validation.valid) throw new Error(`Refusing to save invalid data: ${validation.errors.join('; ')}`);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export function normalizeData(data) {
  const safeSettings = data.settings && typeof data.settings === 'object' ? data.settings : {};
  return {
    ...data,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    initialized: data.initialized === true,
    settings: { openMode: safeSettings.openMode === 'current' ? 'current' : 'new' },
    categories: Array.isArray(data.categories) ? data.categories.map((c, i) => ({
      ...c,
      order: Number.isFinite(c.order) ? c.order : i,
      icon: typeof c.icon === 'string' && c.icon.trim() ? c.icon.trim().slice(0, 2) : '◇',
      color: isHexColor(c.color) ? c.color : '#55cbd3',
      collapsed: c.collapsed === true
    })) : [],
    items: Array.isArray(data.items) ? data.items.map((item, i) => ({
      ...item,
      favorite: item.favorite === true,
      order: Number.isFinite(item.order) ? item.order : i,
      useCount: Number.isFinite(item.useCount) && item.useCount >= 0 ? Math.floor(item.useCount) : 0,
      lastUsed: isIsoDateOrNull(item.lastUsed) ? item.lastUsed : null,
      note: typeof item.note === 'string' ? item.note : ''
    })) : []
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value, max = 1000) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isOptionalString(value, max = 1000) {
  return value === undefined || (typeof value === 'string' && value.length <= max);
}

function isIsoDateOrNull(value) {
  return value === null || value === undefined || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizeHashtag(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const withoutHashes = trimmed.replace(/^#+/, '');
  return withoutHashes ? `#${withoutHashes}` : '';
}

export function normalizeHandle(value) {
  return String(value ?? '').trim().replace(/^@+/, '').replace(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i, '').split(/[/?#]/)[0].trim();
}

const RESERVED_X_PATHS = new Set([
  'about', 'compose', 'explore', 'help', 'home', 'i', 'intent', 'jobs', 'login', 'logout',
  'messages', 'notifications', 'premium', 'privacy', 'search', 'settings', 'share', 'signup',
  'tos', 'verified'
]);

export function parseXProfileUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { valid: false, handle: '', error: 'Paste an X profile URL.' };

  let candidate = raw;
  if (/^(?:www\.)?(?:x\.com|twitter\.com)\//i.test(candidate)) candidate = `https://${candidate}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { valid: false, handle: '', error: 'That does not look like a valid URL.' };
  }

  const host = url.hostname.toLocaleLowerCase();
  if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(host)) {
    return { valid: false, handle: '', error: 'Use a profile URL from x.com.' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, handle: '', error: 'Use a normal http or https X profile URL.' };
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 1) {
    return { valid: false, handle: '', error: 'Paste the profile URL itself, not a post, search, or other X page.' };
  }

  let handle;
  try { handle = decodeURIComponent(segments[0]); }
  catch { return { valid: false, handle: '', error: 'That profile URL contains invalid characters.' }; }

  const handleError = validateHandle(handle);
  if (handleError || RESERVED_X_PATHS.has(handle.toLocaleLowerCase())) {
    return { valid: false, handle: '', error: 'That URL does not point to a normal X profile.' };
  }

  return { valid: true, handle: normalizeHandle(handle), error: '' };
}

export function validateHashtag(value) {
  const tag = normalizeHashtag(value);
  if (!tag || tag === '#') return 'Enter a hashtag.';
  if (tag.length > 80) return 'Hashtag is too long.';
  if (/\s/.test(tag)) return 'Hashtags cannot contain spaces.';
  if (!/^#[\p{L}\p{N}_]+$/u.test(tag)) return 'Use letters, numbers, or underscores after #.';
  return '';
}

export function validateHandle(value) {
  const handle = normalizeHandle(value);
  if (!handle) return 'Enter an X handle.';
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return 'X handles must be 1–15 letters, numbers, or underscores.';
  return '';
}

export function validateData(data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: ['Root value must be an object'] };
  if (data.schemaVersion !== SCHEMA_VERSION) errors.push(`Unsupported schemaVersion: ${String(data.schemaVersion)}`);
  if (!Array.isArray(data.categories)) errors.push('categories must be an array');
  if (!Array.isArray(data.items)) errors.push('items must be an array');
  if (!isPlainObject(data.settings)) errors.push('settings must be an object');
  if (errors.length) return { valid: false, errors };

  const categoryIds = new Set();
  const categoryNames = new Set();
  data.categories.forEach((category, index) => {
    if (!isPlainObject(category)) { errors.push(`Category ${index + 1} must be an object`); return; }
    if (!isNonEmptyString(category.id, 160)) errors.push(`Category ${index + 1} has an invalid id`);
    if (!isNonEmptyString(category.name, 60)) errors.push(`Category ${index + 1} has an invalid name`);
    if (categoryIds.has(category.id)) errors.push(`Duplicate category id: ${category.id}`);
    categoryIds.add(category.id);
    const lowerName = category.name?.trim().toLocaleLowerCase();
    if (lowerName && categoryNames.has(lowerName)) errors.push(`Duplicate category name: ${category.name}`);
    if (lowerName) categoryNames.add(lowerName);
    if (category.icon !== undefined && !isOptionalString(category.icon, 4)) errors.push(`Category ${index + 1} has an invalid icon`);
    if (category.color !== undefined && !isHexColor(category.color)) errors.push(`Category ${index + 1} has an invalid color`);
    if (category.order !== undefined && !Number.isFinite(category.order)) errors.push(`Category ${index + 1} has an invalid order`);
  });

  const itemIds = new Set();
  data.items.forEach((item, index) => {
    const label = `Item ${index + 1}`;
    if (!isPlainObject(item)) { errors.push(`${label} must be an object`); return; }
    if (!isNonEmptyString(item.id, 180)) errors.push(`${label} has an invalid id`);
    if (itemIds.has(item.id)) errors.push(`Duplicate item id: ${item.id}`);
    itemIds.add(item.id);
    if (!['hashtag', 'search', 'person'].includes(item.type)) errors.push(`${label} has an invalid type`);
    if (!isNonEmptyString(item.categoryId, 180) || !categoryIds.has(item.categoryId)) errors.push(`${label} references a missing category`);
    if (!isOptionalString(item.note, 1000)) errors.push(`${label} has an invalid note`);
    if (item.favorite !== undefined && typeof item.favorite !== 'boolean') errors.push(`${label} has an invalid favorite value`);
    if (item.order !== undefined && !Number.isFinite(item.order)) errors.push(`${label} has an invalid order`);
    if (item.useCount !== undefined && (!Number.isFinite(item.useCount) || item.useCount < 0)) errors.push(`${label} has an invalid useCount`);
    if (!isIsoDateOrNull(item.lastUsed)) errors.push(`${label} has an invalid lastUsed value`);

    if (item.type === 'hashtag' && validateHashtag(item.hashtag)) errors.push(`${label} has an invalid hashtag`);
    if (item.type === 'search') {
      if (!isNonEmptyString(item.displayName, 100)) errors.push(`${label} has an invalid displayName`);
      if (!isNonEmptyString(item.query, 500)) errors.push(`${label} has an invalid search query`);
    }
    if (item.type === 'person') {
      if (!isNonEmptyString(item.displayName, 100)) errors.push(`${label} has an invalid displayName`);
      if (validateHandle(item.handle)) errors.push(`${label} has an invalid X handle`);
    }
  });

  if (!['new', 'current'].includes(data.settings.openMode)) errors.push('settings.openMode must be new or current');
  return { valid: errors.length === 0, errors };
}

export function exportPayload(data) {
  return {
    app: 'CurioGems',
    exportVersion: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: normalizeData(structuredClone(data))
  };
}

export function parseImportPayload(rawText) {
  let parsed;
  try { parsed = JSON.parse(rawText); }
  catch { return { valid: false, errors: ['This file is not valid JSON.'] }; }

  const candidate = isPlainObject(parsed) && isPlainObject(parsed.data) ? parsed.data : parsed;
  const validation = validateData(candidate);
  if (!validation.valid) return validation;
  return { valid: true, data: normalizeData(candidate), errors: [] };
}

export function canonicalItemKey(item) {
  if (item.type === 'hashtag') return `hashtag:${normalizeHashtag(item.hashtag).toLocaleLowerCase()}`;
  if (item.type === 'search') return `search:${String(item.query).trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`;
  return `person:${normalizeHandle(item.handle).toLocaleLowerCase()}`;
}

export function previewMerge(current, incoming) {
  const existingNames = new Set(current.categories.map(c => c.name.trim().toLocaleLowerCase()));
  const addedCategories = incoming.categories.filter(c => !existingNames.has(c.name.trim().toLocaleLowerCase())).length;
  const existingKeys = new Set(current.items.map(canonicalItemKey));
  const uniqueIncomingKeys = new Set();
  let addedItems = 0;
  let duplicateItems = 0;
  for (const item of incoming.items) {
    const key = canonicalItemKey(item);
    if (existingKeys.has(key) || uniqueIncomingKeys.has(key)) duplicateItems += 1;
    else { uniqueIncomingKeys.add(key); addedItems += 1; }
  }
  return { addedCategories, addedItems, duplicateItems };
}

export function mergeData(current, incoming) {
  const now = new Date().toISOString();
  const result = structuredClone(current);
  const categoryMap = new Map();
  const usedCategoryIds = new Set(result.categories.map(c => c.id));
  const byName = new Map(result.categories.map(c => [c.name.trim().toLocaleLowerCase(), c]));

  const nextCategoryOrder = () => result.categories.length ? Math.max(...result.categories.map(c => c.order)) + 1 : 0;
  for (const incomingCategory of [...incoming.categories].sort((a,b) => a.order - b.order)) {
    const key = incomingCategory.name.trim().toLocaleLowerCase();
    const existing = byName.get(key);
    if (existing) {
      categoryMap.set(incomingCategory.id, existing.id);
      continue;
    }
    let id = incomingCategory.id;
    if (usedCategoryIds.has(id)) id = randomId('cat');
    usedCategoryIds.add(id);
    const added = { ...incomingCategory, id, order: nextCategoryOrder(), createdAt: incomingCategory.createdAt || now, updatedAt: now };
    result.categories.push(added);
    byName.set(key, added);
    categoryMap.set(incomingCategory.id, id);
  }

  const existingKeys = new Set(result.items.map(canonicalItemKey));
  const usedItemIds = new Set(result.items.map(i => i.id));
  const nextOrders = new Map();
  const nextOrderFor = categoryId => {
    if (!nextOrders.has(categoryId)) {
      const orders = result.items.filter(i => i.categoryId === categoryId).map(i => i.order);
      nextOrders.set(categoryId, orders.length ? Math.max(...orders) + 1 : 0);
    }
    const value = nextOrders.get(categoryId);
    nextOrders.set(categoryId, value + 1);
    return value;
  };

  for (const incomingItem of [...incoming.items].sort((a,b) => a.order - b.order)) {
    const key = canonicalItemKey(incomingItem);
    if (existingKeys.has(key)) continue;
    const categoryId = categoryMap.get(incomingItem.categoryId);
    if (!categoryId) continue;
    let id = incomingItem.id;
    if (usedItemIds.has(id)) id = randomId('item');
    usedItemIds.add(id);
    result.items.push({ ...incomingItem, id, categoryId, order: nextOrderFor(categoryId), updatedAt: now });
    existingKeys.add(key);
  }

  return normalizeData({ ...result, updatedAt: now });
}

export function itemLabel(item) {
  if (item.type === 'hashtag') return normalizeHashtag(item.hashtag);
  if (item.type === 'search') return item.displayName;
  return item.displayName;
}

export function itemSecondary(item) {
  if (item.type === 'hashtag') return 'Hashtag';
  if (item.type === 'search') return item.query;
  return `@${normalizeHandle(item.handle)}`;
}

export function buildXUrl(item) {
  if (!item || !['hashtag', 'search', 'person'].includes(item.type)) throw new Error('Unsupported CurioGems item type');
  if (item.type === 'hashtag') {
    const error = validateHashtag(item.hashtag);
    if (error) throw new Error(error);
    const query = normalizeHashtag(item.hashtag);
    return `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;
  }
  if (item.type === 'search') {
    const query = String(item.query ?? '').trim();
    if (!query || query.length > 500) throw new Error('Invalid search query');
    return `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;
  }
  const handleError = validateHandle(item.handle);
  if (handleError) throw new Error(handleError);
  return `https://x.com/${encodeURIComponent(normalizeHandle(item.handle))}`;
}

export async function openXItem(data, itemId) {
  const item = data.items.find(i => i.id === itemId);
  if (!item) throw new Error('That saved gem no longer exists.');
  const url = buildXUrl(item);
  item.useCount = (item.useCount || 0) + 1;
  item.lastUsed = new Date().toISOString();
  item.updatedAt = item.lastUsed;
  await saveData(data);
  if (data.settings.openMode === 'current') await chrome.tabs.update({ url });
  else await chrome.tabs.create({ url });
  return url;
}

export function reorderWithinCategory(data, itemId, direction) {
  const target = data.items.find(i => i.id === itemId);
  if (!target) return data;
  const peers = data.items.filter(i => i.categoryId === target.categoryId).sort((a,b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  const index = peers.findIndex(i => i.id === itemId);
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= peers.length) return data;
  const other = peers[swapIndex];
  const temp = target.order;
  target.order = other.order;
  other.order = temp;
  if (target.order === other.order) {
    peers.forEach((item, i) => { item.order = i; });
  }
  return data;
}
