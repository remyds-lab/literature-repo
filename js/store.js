import { getCurrentUser, getUserItemsKey } from './auth.js';

const LEGACY_STORAGE_KEY = 'mediaVault_items';

export let items = [];

function normalizeItem(item) {
  const comments = Array.isArray(item.comments) ? item.comments : [];
  if (comments.length === 0 && item.comment) {
    comments.push({
      id: `${item.id}-legacy`,
      text: item.comment,
      createdAt: item.dateUpdated || item.dateAdded || new Date().toISOString(),
    });
  }
  return { ...item, comments };
}

export function getItems() {
  return items;
}

export function loadItems() {
  try {
    const raw = localStorage.getItem(getUserItemsKey()) || (getCurrentUser() === 'caro' ? localStorage.getItem(LEGACY_STORAGE_KEY) : null);
    const parsed = raw ? JSON.parse(raw) : [];
    items = Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
  } catch (err) {
    console.warn('Could not load local data, starting with an empty library.');
    items = [];
  }
}

export function saveItems(newItems) {
  if (newItems) {
    items = newItems;
  }
  localStorage.setItem(getUserItemsKey(), JSON.stringify(items));
  syncToBackend();
}

export function addItem(item) {
  items = [...items, item];
  saveItems();
}

export function updateItem(id, updatedItem) {
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx] = updatedItem;
    saveItems();
  }
}

export function deleteItem(id) {
  items = items.filter(i => i.id !== id);
  saveItems();
}

async function syncToBackend() {
  if (getCurrentUser() !== 'caro') return;
  try {
    await fetch('/api/media', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    });
  } catch (err) {
    console.warn('Sync error (offline mode):', err.message);
  }
}

export async function loadFromBackend() {
  if (getCurrentUser() !== 'caro') return;
  try {
    const res = await fetch('/api/media');
    if (res.ok) {
      const remote = await res.json();
      if (Array.isArray(remote) && remote.length >= items.length) {
        items = remote.map(normalizeItem);
        localStorage.setItem(getUserItemsKey(), JSON.stringify(items));
      } else if (Array.isArray(remote) && items.length > remote.length) {
        await syncToBackend();
      }
    }
  } catch (err) {
    console.warn('Could not load from backend, using local data.');
  }
}
