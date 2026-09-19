import {
  canonicalItemKey,
  createId,
  itemLabel,
  loadData,
  normalizeHandle,
  normalizeHashtag,
  openXItem,
  parseXProfileUrl,
  saveData,
  validateHandle,
  validateHashtag
} from './data.js';
import { el, matchesSearch, sortedCategories, sortedItems, typeBadge } from './ui.js';

let data = null;
const content = document.getElementById('popupContent');
const searchInput = document.getElementById('quickSearch');
const countLabel = document.getElementById('itemCount');
const quickAddDialog = document.getElementById('quickAddDialog');
const quickAddForm = document.getElementById('quickAddForm');

function openDashboard(params = '') {
  const url = chrome.runtime.getURL(`dashboard.html${params}`);
  chrome.tabs.create({ url });
  window.close();
}

function showToast(message, isError = false) {
  const region = document.getElementById('popupToastRegion');
  const toast = el('div', { className: `popup-toast${isError ? ' error' : ''}`, text: message });
  region.replaceChildren(toast);
  setTimeout(() => toast.remove(), 1900);
}

function buildPopupItem(item) {
  const button = el('button', { className: 'popup-item', type: 'button' });
  button.append(
    el('span', { className: 'item-type-icon', text: typeBadge(item) }),
    el('span', { className: 'item-main' },
      el('span', { className: 'item-title', text: itemLabel(item) }),
      el('span', { className: 'item-subtitle', text: item.type === 'person' ? `@${item.handle}` : item.type === 'search' ? item.query : 'Latest posts' })
    )
  );
  if (item.favorite) {
    button.append(el('span', { className: 'favorite-star', text: '★', attrs: { 'aria-label': 'Pinned' } }));
  }
  button.append(el('span', { className: 'open-arrow', text: '↗', attrs: { 'aria-hidden': 'true' } }));
  button.addEventListener('click', async () => {
    try {
      await openXItem(data, item.id);
      if (data.settings.openMode === 'new') window.close();
    } catch (error) {
      renderError(error.message);
    }
  });
  return button;
}

function renderSection(title, items, color = '#55cbd3') {
  if (!items.length) return null;
  const section = el('section', { className: 'popup-section' });
  const heading = el('h2', { className: 'popup-section-title' });
  const dot = el('span', { className: 'dot' });
  dot.style.setProperty('--category-color', color);
  heading.append(dot, document.createTextNode(title));
  section.append(heading, ...items.map(buildPopupItem));
  return section;
}

function renderError(message) {
  content.replaceChildren(el('div', { className: 'empty-state' }, el('strong', { text: 'CurioGems hit a snag' }), el('span', { text: message })));
}

function render() {
  const query = searchInput.value;
  const visibleItems = data.items.filter(item => matchesSearch(data, item, query));
  countLabel.textContent = `${data.items.length} saved`;
  content.replaceChildren();

  if (!visibleItems.length) {
    content.append(el('div', { className: 'empty-state' },
      el('strong', { text: query ? 'No gems match that search' : 'No gems saved yet' }),
      el('span', { text: query ? 'Try another local search.' : 'Add a hashtag, search, or person right here.' })
    ));
    return;
  }

  if (!query.trim()) {
    const pinned = visibleItems.filter(i => i.favorite).sort((a,b) => itemLabel(a).localeCompare(itemLabel(b)));
    const pinnedSection = renderSection('Pinned', pinned, '#f0a35f');
    if (pinnedSection) content.append(pinnedSection);
  }

  for (const category of sortedCategories(data)) {
    const items = sortedItems(data, category.id).filter(item => visibleItems.some(v => v.id === item.id));
    const section = renderSection(category.name, items, category.color);
    if (section) content.append(section);
  }
}

function preferredCategoryId(type) {
  const preferredName = type === 'person' ? 'people' : type === 'search' ? 'research' : 'community';
  return data.categories.find(category => category.name.trim().toLocaleLowerCase() === preferredName)?.id
    || sortedCategories(data)[0]?.id
    || '';
}

function fillQuickCategorySelect(type, preserveCurrent = false) {
  const select = document.getElementById('quickItemCategory');
  const previous = preserveCurrent ? select.value : '';
  select.replaceChildren();
  for (const category of sortedCategories(data)) {
    select.append(el('option', { value: category.id, text: category.name }));
  }
  const target = previous && data.categories.some(c => c.id === previous) ? previous : preferredCategoryId(type);
  if (target) select.value = target;
}

function setQuickTypeFields(type, updateCategory = true) {
  document.getElementById('quickHashtagFields').classList.toggle('is-hidden', type !== 'hashtag');
  document.getElementById('quickSearchFields').classList.toggle('is-hidden', type !== 'search');
  document.getElementById('quickPersonFields').classList.toggle('is-hidden', type !== 'person');
  if (updateCategory) fillQuickCategorySelect(type);
}

function resetPersonUrlStatus() {
  const status = document.getElementById('quickPersonUrlStatus');
  status.textContent = 'Local only: the handle is extracted from what you paste. CurioGems does not read X.';
  status.classList.remove('is-error', 'is-success');
}

function openQuickAdd() {
  quickAddForm.reset();
  document.getElementById('quickAddError').textContent = '';
  resetPersonUrlStatus();
  const hashtagRadio = quickAddForm.querySelector('input[name="quickItemType"][value="hashtag"]');
  hashtagRadio.checked = true;
  setQuickTypeFields('hashtag');
  quickAddDialog.showModal();
  requestAnimationFrame(() => document.getElementById('quickHashtagInput').focus());
}

function closeQuickAdd() {
  if (quickAddDialog.open) quickAddDialog.close();
}

function nextItemOrder(categoryId) {
  const items = data.items.filter(item => item.categoryId === categoryId);
  return items.length ? Math.max(...items.map(item => item.order)) + 1 : 0;
}

function buildQuickItem(type) {
  const now = new Date().toISOString();
  const categoryId = document.getElementById('quickItemCategory').value;
  const base = {
    id: createId('item'),
    type,
    categoryId,
    note: document.getElementById('quickItemNote').value.trim(),
    favorite: document.getElementById('quickItemFavorite').checked,
    order: nextItemOrder(categoryId),
    useCount: 0,
    lastUsed: null,
    createdAt: now,
    updatedAt: now
  };

  if (type === 'hashtag') {
    return { ...base, hashtag: normalizeHashtag(document.getElementById('quickHashtagInput').value) };
  }
  if (type === 'search') {
    return {
      ...base,
      displayName: document.getElementById('quickSearchNameInput').value.trim(),
      query: document.getElementById('quickSearchQueryInput').value.trim()
    };
  }

  const handle = normalizeHandle(document.getElementById('quickPersonHandleInput').value);
  const displayName = document.getElementById('quickPersonNameInput').value.trim() || `@${handle}`;
  return { ...base, displayName, handle };
}

function validateQuickItem(item) {
  if (!item.categoryId || !data.categories.some(category => category.id === item.categoryId)) return 'Choose a valid category.';
  if (item.type === 'hashtag') return validateHashtag(item.hashtag);
  if (item.type === 'search') {
    if (!item.displayName) return 'Enter a display name.';
    if (item.displayName.length > 100) return 'Display name is too long.';
    if (!item.query) return 'Enter an X search query.';
    if (item.query.length > 500) return 'Search query is too long.';
  }
  if (item.type === 'person') {
    const handleError = validateHandle(item.handle);
    if (handleError) return handleError;
    if (!item.displayName || item.displayName.length > 100) return 'Enter a shorter display name.';
  }
  const duplicate = data.items.find(existing => canonicalItemKey(existing) === canonicalItemKey(item));
  if (duplicate) return `That ${item.type} is already saved as “${itemLabel(duplicate)}”.`;
  return '';
}

function extractQuickHandleFromProfileUrl({ focusHandle = true } = {}) {
  const input = document.getElementById('quickPersonProfileUrlInput');
  const status = document.getElementById('quickPersonUrlStatus');
  const result = parseXProfileUrl(input.value);
  status.classList.remove('is-error', 'is-success');
  if (!result.valid) {
    status.textContent = result.error;
    status.classList.add('is-error');
    return false;
  }
  document.getElementById('quickPersonHandleInput').value = `@${result.handle}`;
  status.textContent = `Handle found: @${result.handle}. Nothing was fetched from X.`;
  status.classList.add('is-success');
  if (focusHandle) document.getElementById('quickPersonHandleInput').focus();
  return true;
}

quickAddForm.addEventListener('submit', async event => {
  event.preventDefault();
  const type = quickAddForm.querySelector('input[name="quickItemType"]:checked')?.value || 'hashtag';

  if (type === 'person') {
    const profileUrl = document.getElementById('quickPersonProfileUrlInput').value.trim();
    const handle = document.getElementById('quickPersonHandleInput').value.trim();
    if (profileUrl && !handle && !extractQuickHandleFromProfileUrl({ focusHandle: false })) return;
  }

  const item = buildQuickItem(type);
  const error = validateQuickItem(item);
  document.getElementById('quickAddError').textContent = error;
  if (error) return;

  data.items.push(item);
  try {
    data = await saveData(data);
    closeQuickAdd();
    render();
    showToast('Gem saved.');
  } catch (saveError) {
    data.items = data.items.filter(existing => existing.id !== item.id);
    document.getElementById('quickAddError').textContent = saveError.message;
  }
});

quickAddForm.querySelectorAll('input[name="quickItemType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    document.getElementById('quickAddError').textContent = '';
    setQuickTypeFields(radio.value);
    const target = radio.value === 'hashtag'
      ? document.getElementById('quickHashtagInput')
      : radio.value === 'search'
        ? document.getElementById('quickSearchNameInput')
        : document.getElementById('quickPersonProfileUrlInput');
    requestAnimationFrame(() => target.focus());
  });
});

document.getElementById('quickExtractHandleBtn').addEventListener('click', () => extractQuickHandleFromProfileUrl());
document.getElementById('quickPersonProfileUrlInput').addEventListener('paste', () => {
  setTimeout(() => extractQuickHandleFromProfileUrl({ focusHandle: false }), 0);
});
document.getElementById('quickPersonProfileUrlInput').addEventListener('input', event => {
  if (!event.target.value.trim()) resetPersonUrlStatus();
});
document.getElementById('quickPersonProfileUrlInput').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    extractQuickHandleFromProfileUrl();
  }
});
document.getElementById('quickAddCloseBtn').addEventListener('click', closeQuickAdd);
document.getElementById('quickAddCancelBtn').addEventListener('click', closeQuickAdd);

async function init() {
  try {
    data = await loadData();
    render();
  } catch (error) {
    renderError(error.message);
  }
}

searchInput.addEventListener('input', render);
document.getElementById('openDashboardBtn').addEventListener('click', () => openDashboard());
document.getElementById('manageBtn').addEventListener('click', () => openDashboard('?view=settings'));
document.getElementById('quickAddBtn').addEventListener('click', openQuickAdd);
document.addEventListener('keydown', event => {
  const target = event.target;
  const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  if (event.key === '/' && !quickAddDialog.open && !isTyping) {
    event.preventDefault();
    searchInput.focus();
  }
});

init();
