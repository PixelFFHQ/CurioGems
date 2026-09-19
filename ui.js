import { itemLabel, itemSecondary, normalizeHandle } from './data.js';

export function el(tag, options = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'attrs') for (const [name, attrValue] of Object.entries(value)) node.setAttribute(name, attrValue);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node[key] = value;
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function categoryById(data, id) {
  return data.categories.find(c => c.id === id);
}

export function sortedCategories(data) {
  return [...data.categories].sort((a,b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function sortedItems(data, categoryId = null) {
  return data.items
    .filter(i => categoryId === null || i.categoryId === categoryId)
    .sort((a,b) => a.order - b.order || itemLabel(a).localeCompare(itemLabel(b)));
}

export function matchesSearch(data, item, rawQuery) {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return true;
  const category = categoryById(data, item.categoryId);
  const haystack = [
    item.type,
    itemLabel(item),
    itemSecondary(item),
    item.note,
    item.hashtag,
    item.query,
    item.displayName,
    item.handle ? `@${normalizeHandle(item.handle)}` : '',
    category?.name ?? ''
  ].filter(Boolean).join(' ').toLocaleLowerCase();
  return haystack.includes(query);
}

export function typeBadge(item) {
  if (item.type === 'hashtag') return '#';
  if (item.type === 'search') return '⌕';
  return '@';
}

export function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).format(date);
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the user-gesture copy fallback.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Copy was blocked by the browser.');
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
