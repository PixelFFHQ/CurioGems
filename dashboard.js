import {
  canonicalItemKey,
  createId,
  exportPayload,
  itemLabel,
  itemSecondary,
  loadData,
  mergeData,
  normalizeHandle,
  normalizeHashtag,
  openXItem,
  parseImportPayload,
  parseXProfileUrl,
  previewMerge,
  reorderWithinCategory,
  saveData,
  validateHandle,
  validateHashtag
} from './data.js';
import {
  categoryById,
  copyText,
  downloadJson,
  el,
  formatDate,
  matchesSearch,
  sortedCategories,
  sortedItems,
  typeBadge
} from './ui.js';

let data = null;
let activeView = 'radar';
let activeCategoryId = null;
let pendingConfirmResolver = null;
let pendingImportData = null;

const radarView = document.getElementById('radarView');
const settingsView = document.getElementById('settingsView');
const radarContent = document.getElementById('radarContent');
const globalSearch = document.getElementById('globalSearch');
const categoryNav = document.getElementById('categoryNav');
const summaryStats = document.getElementById('summaryStats');
const itemDialog = document.getElementById('itemDialog');
const itemForm = document.getElementById('itemForm');
const categoryDialog = document.getElementById('categoryDialog');
const confirmDialog = document.getElementById('confirmDialog');
const importDialog = document.getElementById('importDialog');

function showToast(message, isError = false) {
  const toast = el('div', { className: `toast${isError ? ' error' : ''}`, text: message });
  document.getElementById('toastRegion').append(toast);
  setTimeout(() => toast.remove(), 3200);
}

function sortedCategoryItems(categoryId) {
  return sortedItems(data, categoryId);
}

function saveAndRender(message = '') {
  return saveData(data).then(saved => {
    data = saved;
    renderAll();
    if (message) showToast(message);
  }).catch(error => showToast(error.message, true));
}

function setActiveView(view, categoryId = null) {
  activeView = view;
  activeCategoryId = categoryId;
  const isSettings = view === 'settings';
  radarView.classList.toggle('is-hidden', isSettings);
  settingsView.classList.toggle('is-hidden', !isSettings);

  document.querySelectorAll('.side-nav .nav-item, #settingsNavBtn, .category-nav .nav-item').forEach(btn => btn.classList.remove('is-active'));
  if (view === 'radar' || view === 'pinned' || view === 'recent') {
    document.querySelector(`[data-view="${view}"]`)?.classList.add('is-active');
  } else if (view === 'settings') {
    document.getElementById('settingsNavBtn').classList.add('is-active');
  } else if (view === 'category' && categoryId) {
    categoryNav.querySelector(`[data-category-id="${CSS.escape(categoryId)}"]`)?.classList.add('is-active');
  }

  if (!isSettings) renderRadar();
}

function renderSidebar() {
  categoryNav.replaceChildren();
  for (const category of sortedCategories(data)) {
    const count = data.items.filter(item => item.categoryId === category.id).length;
    const button = el('button', {
      className: `nav-item${activeView === 'category' && activeCategoryId === category.id ? ' is-active' : ''}`,
      type: 'button',
      dataset: { categoryId: category.id }
    });
    const dot = el('span', { className: 'category-dot' });
    dot.style.setProperty('--category-color', category.color);
    const name = el('span', { text: category.name });
    name.style.cssText = 'width:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;';
    button.append(dot, name, el('span', { className: 'category-count', text: String(count) }));
    button.addEventListener('click', () => setActiveView('category', category.id));
    categoryNav.append(button);
  }
}

function renderSummary() {
  const counts = {
    hashtags: data.items.filter(i => i.type === 'hashtag').length,
    searches: data.items.filter(i => i.type === 'search').length,
    people: data.items.filter(i => i.type === 'person').length
  };
  summaryStats.replaceChildren(
    statPill(data.items.length, 'Saved'),
    statPill(counts.hashtags, 'Hashtags'),
    statPill(counts.searches, 'Searches'),
    statPill(counts.people, 'People')
  );
}

function statPill(value, label) {
  return el('div', { className: 'stat-pill' }, el('strong', { text: String(value) }), el('span', { text: label }));
}

function currentFilteredItems() {
  const query = globalSearch.value.trim();
  if (query) return data.items.filter(item => matchesSearch(data, item, query));
  if (activeView === 'pinned') return data.items.filter(i => i.favorite);
  if (activeView === 'recent') return data.items.filter(i => i.lastUsed).sort((a,b) => new Date(b.lastUsed) - new Date(a.lastUsed)).slice(0, 30);
  if (activeView === 'category' && activeCategoryId) return data.items.filter(i => i.categoryId === activeCategoryId);
  return data.items;
}

function sectionTitleForView() {
  if (globalSearch.value.trim()) return `Search results for “${globalSearch.value.trim()}”`;
  if (activeView === 'pinned') return 'Pinned';
  if (activeView === 'recent') return 'Recently opened';
  if (activeView === 'category') return categoryById(data, activeCategoryId)?.name || 'Category';
  return '';
}

function renderRadar() {
  if (!data) return;
  renderSummary();
  radarContent.replaceChildren();
  const visible = currentFilteredItems();
  const query = globalSearch.value.trim();

  if (!visible.length) {
    radarContent.append(el('div', { className: 'empty-state' },
      el('strong', { text: query ? 'No gems match that search' : activeView === 'pinned' ? 'Nothing pinned yet' : activeView === 'recent' ? 'No recent launches yet' : 'Nothing here yet' }),
      el('span', { text: query ? 'Try a different word. CurioGems searches names, values, categories, and notes.' : 'Save something useful when you find it.' })
    ));
    return;
  }

  if (query || activeView === 'pinned' || activeView === 'recent') {
    const ordered = activeView === 'recent' && !query
      ? visible
      : [...visible].sort((a,b) => itemLabel(a).localeCompare(itemLabel(b)));
    radarContent.append(buildCategorySection({
      id: '__virtual__', name: sectionTitleForView(), icon: query ? '⌕' : activeView === 'pinned' ? '★' : '◷', color: query ? '#55cbd3' : activeView === 'pinned' ? '#f0a35f' : '#a98cf5', collapsed: false
    }, ordered, true));
    return;
  }

  if (activeView === 'category' && activeCategoryId) {
    const category = categoryById(data, activeCategoryId);
    if (category) radarContent.append(buildCategorySection(category, sortedCategoryItems(category.id), true));
    return;
  }

  const pinned = data.items.filter(i => i.favorite).sort((a,b) => itemLabel(a).localeCompare(itemLabel(b)));
  if (pinned.length) {
    radarContent.append(buildCategorySection({ id: '__pinned__', name: 'Pinned', icon: '★', color: '#f0a35f', collapsed: false }, pinned, true));
  }

  for (const category of sortedCategories(data)) {
    radarContent.append(buildCategorySection(category, sortedCategoryItems(category.id), false));
  }
}

function buildCategorySection(category, items, virtual) {
  const section = el('section', { className: `category-section${category.collapsed && !globalSearch.value.trim() ? ' is-collapsed' : ''}` });
  section.style.setProperty('--category-color', category.color);
  const header = el('button', { className: 'category-header', type: 'button' });
  const icon = el('span', { className: 'category-icon', text: category.icon || '◇' });
  icon.style.setProperty('--category-color', category.color);
  const metaText = virtual && activeView === 'recent' && !globalSearch.value.trim()
    ? `${items.length} recent ${items.length === 1 ? 'item' : 'items'}`
    : `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  header.append(icon, el('span', { className: 'category-header-copy' }, el('strong', { text: category.name }), el('span', { text: metaText })), el('span', { className: 'chevron', text: '⌄' }));
  section.append(header);

  const itemsWrap = el('div', { className: 'category-items' });
  if (!items.length) itemsWrap.append(el('div', { className: 'category-empty', text: 'No entries in this category yet.' }));
  else items.forEach(item => itemsWrap.append(buildRadarItem(item, virtual)));
  section.append(itemsWrap);

  header.addEventListener('click', async () => {
    if (virtual || globalSearch.value.trim()) {
      section.classList.toggle('is-collapsed');
      return;
    }
    category.collapsed = !category.collapsed;
    section.classList.toggle('is-collapsed', category.collapsed);
    try { data = await saveData(data); }
    catch (error) { showToast(error.message, true); }
  });
  return section;
}

function iconButton(label, title, className = '') {
  return el('button', { type: 'button', className, text: label, attrs: { title, 'aria-label': title } });
}

function buildRadarItem(item, virtual) {
  const category = categoryById(data, item.categoryId);
  const row = el('div', { className: 'radar-item' });
  row.style.setProperty('--category-color', category?.color || '#55cbd3');
  const main = el('div', { className: 'item-main' },
    el('div', { className: 'item-title', text: itemLabel(item) }),
    el('div', { className: 'item-subtitle', text: itemSecondary(item) })
  );
  if (item.note) main.append(el('div', { className: 'item-note', text: item.note }));
  else if (item.lastUsed) main.append(el('div', { className: 'item-note', text: `Last opened ${formatDate(item.lastUsed)} · ${item.useCount || 0} launches` }));

  const actions = el('div', { className: 'item-actions' });
  const pin = iconButton(item.favorite ? '★' : '☆', item.favorite ? 'Unpin entry' : 'Pin entry', `pin-button${item.favorite ? ' is-pinned' : ''}`);
  pin.addEventListener('click', event => { event.stopPropagation(); item.favorite = !item.favorite; saveAndRender(item.favorite ? 'Pinned.' : 'Unpinned.'); });
  const copyValue = item.type === 'hashtag' ? normalizeHashtag(item.hashtag) : item.type === 'person' ? `@${normalizeHandle(item.handle)}` : item.query;
  const copy = iconButton('⧉', `Copy ${item.type === 'person' ? 'handle' : item.type === 'hashtag' ? 'hashtag' : 'query'}`);
  copy.addEventListener('click', async event => {
    event.stopPropagation();
    try { await copyText(copyValue); showToast('Copied to clipboard.'); }
    catch { showToast('Could not copy to clipboard.', true); }
  });
  const edit = iconButton('✎', 'Edit entry');
  edit.addEventListener('click', event => { event.stopPropagation(); openItemDialog(item); });

  if (!virtual && activeView !== 'recent') {
    const peers = sortedCategoryItems(item.categoryId);
    const index = peers.findIndex(i => i.id === item.id);
    const up = iconButton('↑', 'Move up', 'reorder-button');
    const down = iconButton('↓', 'Move down', 'reorder-button');
    up.disabled = index <= 0;
    down.disabled = index < 0 || index >= peers.length - 1;
    up.addEventListener('click', event => { event.stopPropagation(); reorderWithinCategory(data, item.id, 'up'); saveAndRender(); });
    down.addEventListener('click', event => { event.stopPropagation(); reorderWithinCategory(data, item.id, 'down'); saveAndRender(); });
    actions.append(up, down);
  }

  const del = iconButton('×', 'Delete entry', 'delete-button');
  del.addEventListener('click', async event => {
    event.stopPropagation();
    const yes = await askConfirm('Delete this entry?', `${itemLabel(item)} will be removed from CurioGems.`, 'Delete');
    if (!yes) return;
    data.items = data.items.filter(i => i.id !== item.id);
    await saveAndRender('Entry deleted.');
  });
  const open = iconButton('Open ↗', 'Open on X', 'open-button');
  open.addEventListener('click', async event => {
    event.stopPropagation();
    try {
      await openXItem(data, item.id);
      renderRadar();
    } catch (error) { showToast(error.message, true); }
  });
  actions.prepend(pin, copy, edit);
  actions.append(del, open);

  row.append(el('span', { className: 'item-type-icon', text: typeBadge(item) }), main, actions);
  return row;
}

function fillCategorySelect(selectedId) {
  const select = document.getElementById('itemCategory');
  select.replaceChildren();
  for (const category of sortedCategories(data)) {
    select.append(el('option', { value: category.id, text: category.name, selected: category.id === selectedId }));
  }
}

function setTypeFields(type) {
  document.getElementById('hashtagFields').classList.toggle('is-hidden', type !== 'hashtag');
  document.getElementById('searchFields').classList.toggle('is-hidden', type !== 'search');
  document.getElementById('personFields').classList.toggle('is-hidden', type !== 'person');
}

function openItemDialog(item = null) {
  itemForm.reset();
  document.getElementById('itemFormError').textContent = '';
  document.getElementById('itemId').value = item?.id || '';
  document.getElementById('itemDialogTitle').textContent = item ? 'Edit gem' : 'Add a gem';
  const type = item?.type || 'hashtag';
  itemForm.querySelector(`input[name="itemType"][value="${type}"]`).checked = true;
  itemForm.querySelectorAll('input[name="itemType"]').forEach(radio => { radio.disabled = Boolean(item); });
  setTypeFields(type);
  const defaultCategory = item?.categoryId || activeCategoryId || sortedCategories(data)[0]?.id;
  fillCategorySelect(defaultCategory);
  document.getElementById('itemFavorite').checked = item?.favorite === true;
  document.getElementById('itemNote').value = item?.note || '';
  document.getElementById('hashtagInput').value = item?.type === 'hashtag' ? item.hashtag : '';
  document.getElementById('searchNameInput').value = item?.type === 'search' ? item.displayName : '';
  document.getElementById('searchQueryInput').value = item?.type === 'search' ? item.query : '';
  document.getElementById('personProfileUrlInput').value = '';
  document.getElementById('personUrlStatus').textContent = 'Local only: CurioGems extracts the handle from the pasted URL and does not read X.';
  document.getElementById('personUrlStatus').classList.remove('is-error', 'is-success');
  document.getElementById('personNameInput').value = item?.type === 'person' ? item.displayName : '';
  document.getElementById('personHandleInput').value = item?.type === 'person' ? `@${normalizeHandle(item.handle)}` : '';
  itemDialog.showModal();
  requestAnimationFrame(() => {
    const target = type === 'hashtag' ? document.getElementById('hashtagInput') : type === 'search' ? document.getElementById('searchNameInput') : document.getElementById('personProfileUrlInput');
    target.focus();
  });
}

function nextItemOrder(categoryId, excludeId = '') {
  const items = data.items.filter(i => i.categoryId === categoryId && i.id !== excludeId);
  return items.length ? Math.max(...items.map(i => i.order)) + 1 : 0;
}

function buildFormItem(existing, type) {
  const now = new Date().toISOString();
  const categoryId = document.getElementById('itemCategory').value;
  const base = {
    id: existing?.id || createId('item'),
    type,
    categoryId,
    note: document.getElementById('itemNote').value.trim(),
    favorite: document.getElementById('itemFavorite').checked,
    order: existing && existing.categoryId === categoryId ? existing.order : nextItemOrder(categoryId, existing?.id),
    useCount: existing?.useCount || 0,
    lastUsed: existing?.lastUsed || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (type === 'hashtag') return { ...base, hashtag: normalizeHashtag(document.getElementById('hashtagInput').value) };
  if (type === 'search') return { ...base, displayName: document.getElementById('searchNameInput').value.trim(), query: document.getElementById('searchQueryInput').value.trim() };
  const handle = normalizeHandle(document.getElementById('personHandleInput').value);
  const displayName = document.getElementById('personNameInput').value.trim() || `@${handle}`;
  return { ...base, displayName, handle };
}

function validateFormItem(item) {
  if (!item.categoryId || !categoryById(data, item.categoryId)) return 'Choose a valid category.';
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
  const duplicate = data.items.find(existing => existing.id !== item.id && canonicalItemKey(existing) === canonicalItemKey(item));
  if (duplicate) return `That ${item.type} is already saved as “${itemLabel(duplicate)}”.`;
  return '';
}

itemForm.addEventListener('submit', async event => {
  event.preventDefault();
  const existingId = document.getElementById('itemId').value;
  const existing = data.items.find(i => i.id === existingId) || null;
  const type = existing?.type || itemForm.querySelector('input[name="itemType"]:checked').value;
  const item = buildFormItem(existing, type);
  const error = validateFormItem(item);
  document.getElementById('itemFormError').textContent = error;
  if (error) return;
  if (existing) data.items = data.items.map(i => i.id === existing.id ? item : i);
  else data.items.push(item);
  try {
    data = await saveData(data);
    itemDialog.close();
    renderAll();
    showToast(existing ? 'Entry updated.' : 'Gem saved.');
  } catch (saveError) {
    document.getElementById('itemFormError').textContent = saveError.message;
  }
});

function extractHandleFromProfileUrl() {
  const input = document.getElementById('personProfileUrlInput');
  const status = document.getElementById('personUrlStatus');
  const result = parseXProfileUrl(input.value);
  status.classList.remove('is-error', 'is-success');
  if (!result.valid) {
    status.textContent = result.error;
    status.classList.add('is-error');
    return false;
  }
  document.getElementById('personHandleInput').value = `@${result.handle}`;
  status.textContent = `Handle found: @${result.handle}. Nothing was fetched from X.`;
  status.classList.add('is-success');
  document.getElementById('personHandleInput').focus();
  return true;
}

document.getElementById('extractHandleBtn').addEventListener('click', extractHandleFromProfileUrl);
document.getElementById('personProfileUrlInput').addEventListener('paste', () => {
  setTimeout(extractHandleFromProfileUrl, 0);
});
document.getElementById('personProfileUrlInput').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    extractHandleFromProfileUrl();
  }
});

itemForm.querySelectorAll('input[name="itemType"]').forEach(radio => radio.addEventListener('change', () => { if (radio.checked) setTypeFields(radio.value); }));

function renderCategoryManager() {
  const manager = document.getElementById('categoryManager');
  manager.replaceChildren();
  const categories = sortedCategories(data);
  for (const [index, category] of categories.entries()) {
    const count = data.items.filter(i => i.categoryId === category.id).length;
    const iconInput = el('input', { type: 'text', value: category.icon || '◇', maxLength: 2, attrs: { 'aria-label': `${category.name} icon` } });
    const nameInput = el('input', { type: 'text', value: category.name, maxLength: 60, attrs: { 'aria-label': 'Category name' } });
    const colorInput = el('input', { type: 'color', value: category.color, attrs: { 'aria-label': `${category.name} color` } });
    const up = iconButton('↑', 'Move category up');
    const down = iconButton('↓', 'Move category down');
    const del = iconButton('×', 'Delete category', 'delete-category');
    up.disabled = index === 0;
    down.disabled = index === categories.length - 1;
    del.disabled = categories.length <= 1;

    const saveCategoryEdits = async () => {
      const name = nameInput.value.trim();
      const icon = iconInput.value.trim() || '◇';
      if (!name) { showToast('Category names cannot be empty.', true); nameInput.value = category.name; return; }
      const duplicate = data.categories.some(c => c.id !== category.id && c.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
      if (duplicate) { showToast('A category with that name already exists.', true); nameInput.value = category.name; return; }
      category.name = name;
      category.icon = icon.slice(0, 2);
      category.color = colorInput.value;
      category.updatedAt = new Date().toISOString();
      await saveAndRender();
      renderCategoryManager();
    };
    nameInput.addEventListener('change', saveCategoryEdits);
    iconInput.addEventListener('change', saveCategoryEdits);
    colorInput.addEventListener('change', saveCategoryEdits);
    up.addEventListener('click', () => moveCategory(category.id, 'up'));
    down.addEventListener('click', () => moveCategory(category.id, 'down'));
    del.addEventListener('click', () => deleteCategory(category.id));

    manager.append(el('div', { className: 'category-editor-row' }, iconInput, nameInput, colorInput, el('span', { className: 'count-label', text: `${count} item${count === 1 ? '' : 's'}` }), up, down, del));
  }
}

async function moveCategory(categoryId, direction) {
  const categories = sortedCategories(data);
  const index = categories.findIndex(c => c.id === categoryId);
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= categories.length) return;
  categories.forEach((category, i) => { category.order = i; });
  const a = categories[index].order;
  categories[index].order = categories[swapIndex].order;
  categories[swapIndex].order = a;
  await saveAndRender();
  renderCategoryManager();
}

async function deleteCategory(categoryId) {
  const category = categoryById(data, categoryId);
  if (!category || data.categories.length <= 1) return;
  const destination = sortedCategories(data).find(c => c.id !== categoryId);
  const count = data.items.filter(i => i.categoryId === categoryId).length;
  const message = count
    ? `Delete “${category.name}”? Its ${count} saved ${count === 1 ? 'item' : 'items'} will move to “${destination.name}” so nothing is lost.`
    : `Delete the empty “${category.name}” category?`;
  const yes = await askConfirm('Delete category?', message, 'Delete category');
  if (!yes) return;
  let order = nextItemOrder(destination.id);
  for (const item of data.items.filter(i => i.categoryId === categoryId).sort((a,b) => a.order - b.order)) {
    item.categoryId = destination.id;
    item.order = order++;
  }
  data.categories = data.categories.filter(c => c.id !== categoryId);
  sortedCategories(data).forEach((c, i) => { c.order = i; });
  if (activeCategoryId === categoryId) { activeCategoryId = destination.id; activeView = 'category'; }
  await saveAndRender('Category deleted; its entries were preserved.');
  renderCategoryManager();
}

function openCategoryManager() {
  renderCategoryManager();
  document.getElementById('categoryFormError').textContent = '';
  categoryDialog.showModal();
}

document.getElementById('newCategoryForm').addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.getElementById('newCategoryName').value.trim();
  const icon = document.getElementById('newCategoryIcon').value.trim() || '◇';
  const color = document.getElementById('newCategoryColor').value;
  const error = document.getElementById('categoryFormError');
  error.textContent = '';
  if (!name) { error.textContent = 'Enter a category name.'; return; }
  if (data.categories.some(c => c.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { error.textContent = 'That category already exists.'; return; }
  const now = new Date().toISOString();
  data.categories.push({ id: createId('cat'), name, icon: icon.slice(0, 2), color, order: data.categories.length, collapsed: false, createdAt: now, updatedAt: now });
  await saveAndRender('Category added.');
  event.currentTarget.reset();
  document.getElementById('newCategoryIcon').value = '◇';
  document.getElementById('newCategoryColor').value = '#55cbd3';
  renderCategoryManager();
});

function askConfirm(title, message, acceptLabel = 'Confirm') {
  if (pendingConfirmResolver) pendingConfirmResolver(false);
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmAcceptBtn').textContent = acceptLabel;
  confirmDialog.showModal();
  return new Promise(resolve => { pendingConfirmResolver = resolve; });
}

function resolveConfirm(value) {
  if (!pendingConfirmResolver) return;
  const resolver = pendingConfirmResolver;
  pendingConfirmResolver = null;
  confirmDialog.close();
  resolver(value);
}

document.getElementById('confirmAcceptBtn').addEventListener('click', () => resolveConfirm(true));
document.getElementById('confirmCancelBtn').addEventListener('click', () => resolveConfirm(false));
confirmDialog.addEventListener('cancel', event => { event.preventDefault(); resolveConfirm(false); });

function updateSettingsUI() {
  document.querySelectorAll('[data-open-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.openMode === data.settings.openMode));
}

async function setOpenMode(mode) {
  data.settings.openMode = mode;
  try { data = await saveData(data); updateSettingsUI(); showToast(mode === 'new' ? 'X links will open in a new tab.' : 'X links will use the current tab.'); }
  catch (error) { showToast(error.message, true); }
}

function renderAll() {
  renderSidebar();
  updateSettingsUI();
  if (activeView !== 'settings') renderRadar();
}

function showImportPreview(incoming) {
  pendingImportData = incoming;
  const preview = previewMerge(data, incoming);
  const target = document.getElementById('importPreview');
  target.replaceChildren(
    previewStat(incoming.categories.length, 'Categories in backup'),
    previewStat(incoming.items.length, 'Items in backup'),
    previewStat(preview.duplicateItems, 'Merge duplicates skipped'),
    previewStat(preview.addedCategories, 'Categories merge adds'),
    previewStat(preview.addedItems, 'Items merge adds'),
    previewStat(data.items.length, 'Items you have now')
  );
  importDialog.showModal();
}

function previewStat(value, label) {
  return el('div', { className: 'preview-stat' }, el('strong', { text: String(value) }), el('span', { text: label }));
}

async function handleImportFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('That file is too large for a CurioGems backup.', true); return; }
  let text;
  try { text = await file.text(); }
  catch { showToast('Could not read that file.', true); return; }
  const parsed = parseImportPayload(text);
  if (!parsed.valid) { showToast(`Import rejected: ${parsed.errors.slice(0, 3).join(' ')}`, true); return; }
  showImportPreview(parsed.data);
}

async function mergeImport() {
  if (!pendingImportData) return;
  try {
    data = mergeData(data, pendingImportData);
    data = await saveData(data);
    pendingImportData = null;
    importDialog.close();
    renderAll();
    showToast('Backup merged. Existing entries were kept.');
  } catch (error) { showToast(error.message, true); }
}

async function replaceImport() {
  if (!pendingImportData) return;
  importDialog.close();
  const yes = await askConfirm('Replace all CurioGems data?', 'Your current categories, entries, usage history, and link-opening preference will be replaced by the validated backup.', 'Replace all');
  if (!yes) { importDialog.showModal(); return; }
  try {
    data = await saveData(pendingImportData);
    pendingImportData = null;
    activeView = 'radar';
    activeCategoryId = null;
    globalSearch.value = '';
    renderAll();
    setActiveView('radar');
    showToast('Backup restored.');
  } catch (error) { showToast(error.message, true); }
}

for (const button of document.querySelectorAll('[data-close-dialog]')) {
  button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
}

for (const button of document.querySelectorAll('.side-nav .nav-item')) {
  button.addEventListener('click', () => setActiveView(button.dataset.view));
}

document.getElementById('settingsNavBtn').addEventListener('click', () => setActiveView('settings'));
document.getElementById('addItemBtn').addEventListener('click', () => openItemDialog());
document.getElementById('manageCategoriesBtn').addEventListener('click', openCategoryManager);
document.getElementById('manageCategoriesShortcut').addEventListener('click', openCategoryManager);
document.getElementById('openNewTabSetting').addEventListener('click', () => setOpenMode('new'));
document.getElementById('openCurrentTabSetting').addEventListener('click', () => setOpenMode('current'));
document.getElementById('exportBtn').addEventListener('click', () => {
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(`curiogems-backup-${date}.json`, exportPayload(data));
  showToast('Backup exported.');
});
document.getElementById('importInput').addEventListener('change', async event => {
  await handleImportFile(event.target.files?.[0]);
  event.target.value = '';
});
document.getElementById('importMergeBtn').addEventListener('click', mergeImport);
document.getElementById('importReplaceBtn').addEventListener('click', replaceImport);
document.getElementById('importCancelBtn').addEventListener('click', () => { pendingImportData = null; importDialog.close(); });

globalSearch.addEventListener('input', () => {
  if (activeView === 'settings') setActiveView('radar');
  else renderRadar();
});

document.addEventListener('keydown', event => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (event.key === '/' && !typing && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    globalSearch.focus();
  } else if ((event.key === 'a' || event.key === 'A') && !typing && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    openItemDialog();
  }
});

async function init() {
  try {
    data = await loadData();
    renderAll();
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'settings') setActiveView('settings');
    else setActiveView('radar');
    if (params.get('add') === '1') openItemDialog();
  } catch (error) {
    radarContent.replaceChildren(el('div', { className: 'empty-state' },
      el('strong', { text: 'CurioGems could not load its local data' }),
      el('span', { text: error.message })
    ));
    showToast(error.message, true);
  }
}

init();
