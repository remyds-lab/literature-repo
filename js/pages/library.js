import { $, $$ } from '../utils.js';
import { getItems } from '../store.js';
import { renderItemCard } from '../ui/card.js';
import { openModal } from '../ui/modal.js';

let currentGenre = '';
let currentGroup = '';

const categoryGroups = {
  'Serie': 'media',
  'Película': 'media',
  'Novela Web': 'written',
  'LN': 'written',
  'Literatura Clásica': 'written',
  'Literatura Juvenil': 'written',
  'Ciencia Ficción': 'written',
  'Manga': 'visual',
  'Manhua': 'visual',
  'Manhwa': 'visual',
};

function itemGroup(item) {
  return categoryGroups[item.category] || '';
}

function getGenres(items) {
  return [...new Set(items.flatMap(item => (item.genre || '')
    .split(',').map(genre => genre.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
}

function updateGenreTabs(items) {
  const tabs = $('#genreTabs');
  if (!tabs) return;
  const genres = getGenres(currentGroup ? items.filter(item => itemGroup(item) === currentGroup) : items);
  tabs.innerHTML = `<button class="cat-tab${currentGenre === '' ? ' active' : ''}" data-genre="">Todos</button>` +
    genres.map(genre => `<button class="cat-tab${genre === currentGenre ? ' active' : ''}" data-genre="${genre.replace(/"/g, '&quot;')}">${genre}</button>`).join('');
  tabs.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentGenre = tab.dataset.genre;
      updateGenreTabs(items);
      renderLibrary();
    });
  });
}

export function setupLibrary() {
  $$('.library-group-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.library-group-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentGroup = tab.dataset.group;
      currentGenre = '';
      renderLibrary();
    });
  });

  $('#libSearch')?.addEventListener('input', renderLibrary);
  $('#libStatusFilter')?.addEventListener('change', renderLibrary);
  $('#libSortBy')?.addEventListener('change', renderLibrary);
  $('#manualAddBtn')?.addEventListener('click', () => openModal());
}

export function renderLibrary() {
  const items = getItems();
  updateGenreTabs(items);
  const query = ($('#libSearch')?.value || '').toLowerCase();
  const statusFilter = $('#libStatusFilter')?.value || '';
  const sortBy = $('#libSortBy')?.value || 'dateAdded';

  let filtered = items.filter(i => {
    const matchTitle = i.title.toLowerCase().includes(query);
    const genres = (i.genre || '').split(',').map(genre => genre.trim().toLowerCase()).filter(Boolean);
    const matchGenre = currentGenre === '' || genres.includes(currentGenre.toLowerCase());
    const matchGroup = currentGroup === '' || itemGroup(i) === currentGroup;
    const matchStatus = statusFilter === '' || i.status === statusFilter;
    return matchTitle && matchGenre && matchGroup && matchStatus;
  });

  if (sortBy === 'title') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === 'rating') {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else {
    filtered.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  }

  const grid = $('#libraryGrid');
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="empty-state">No se encontraron ítems con los filtros actuales.</p>`;
    return;
  }
  
  grid.innerHTML = filtered.map(i => renderItemCard(i)).join('');
  
  grid.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const item = getItems().find(i => i.id === id);
      if (item) openModal(item);
    });
  });
}
