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

const statusesByGroup = {
  visual: ['Planeo Leer', 'Leyendo', 'Leído', 'En Pausa', 'Abandonado'],
  written: ['Planeo Leer', 'Leyendo', 'Leído', 'En Pausa', 'Abandonado'],
  media: ['Planeo Ver', 'Viendo', 'Visto', 'En Pausa', 'Abandonado'],
};

function itemGroup(item) {
  return categoryGroups[item.category] || '';
}

function getGenres(items) {
  return [...new Set(items.flatMap(item => (item.genre || '')
    .split(',').map(genre => genre.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
}

function updateGenreFilter(items) {
  const select = $('#libGenreFilter');
  if (!select) return;
  const selected = select.value;
  const genres = getGenres(currentGroup ? items.filter(item => itemGroup(item) === currentGroup) : items);
  select.innerHTML = '<option value="">Todos los géneros</option>' + genres
    .map(genre => `<option value="${genre.replace(/"/g, '&quot;')}">${genre}</option>`).join('');
  select.value = genres.includes(selected) ? selected : '';
  currentGenre = select.value;
}

function updateStatusFilter() {
  const select = $('#libStatusFilter');
  if (!select) return;
  const selected = select.value;
  const statuses = currentGroup ? statusesByGroup[currentGroup] : [
    ...new Set(Object.values(statusesByGroup).flat()),
  ];
  select.innerHTML = '<option value="">Todos los estados</option>' + statuses
    .map(status => `<option value="${status}">${status}</option>`).join('');
  select.value = statuses.includes(selected) ? selected : '';
}

export function setupLibrary() {
  updateStatusFilter();
  $$('.library-group-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.library-group-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentGroup = tab.dataset.group;
      currentGenre = '';
      updateStatusFilter();
      const genreFilter = $('#libGenreFilter');
      if (genreFilter) genreFilter.value = '';
      renderLibrary();
    });
  });

  $('#libSearch')?.addEventListener('input', renderLibrary);
  $('#libStatusFilter')?.addEventListener('change', renderLibrary);
  $('#libPriorityFilter')?.addEventListener('change', renderLibrary);
  $('#libGenreFilter')?.addEventListener('change', renderLibrary);
  $('#libSortBy')?.addEventListener('change', renderLibrary);
  $('#manualAddBtn')?.addEventListener('click', () => openModal());
}

export function renderLibrary() {
  const items = getItems();
  updateGenreFilter(items);
  const query = ($('#libSearch')?.value || '').toLowerCase();
  const statusFilter = $('#libStatusFilter')?.value || '';
  const priorityFilter = $('#libPriorityFilter')?.value || '';
  const sortBy = $('#libSortBy')?.value || 'dateAdded';

  let filtered = items.filter(i => {
    const matchTitle = i.title.toLowerCase().includes(query);
    const genres = (i.genre || '').split(',').map(genre => genre.trim().toLowerCase()).filter(Boolean);
    const matchGenre = currentGenre === '' || genres.includes(currentGenre.toLowerCase());
    const matchGroup = currentGroup === '' || itemGroup(i) === currentGroup;
    const matchStatus = statusFilter === '' || i.status === statusFilter;
    const matchPriority = priorityFilter === '' || (i.priority || 'medium') === priorityFilter;
    return matchTitle && matchGenre && matchGroup && matchStatus && matchPriority;
  });

  if (sortBy === 'title') {
    filtered.sort((a, b) => priorityOf(b) - priorityOf(a) || a.title.localeCompare(b.title));
  } else if (sortBy === 'rating') {
    filtered.sort((a, b) => priorityOf(b) - priorityOf(a) || (b.rating || 0) - (a.rating || 0));
  } else {
    filtered.sort((a, b) => priorityOf(b) - priorityOf(a) || new Date(b.dateAdded) - new Date(a.dateAdded));
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

function priorityOf(item) {
  return { high: 3, medium: 2, low: 1 }[item.priority] || 2;
}
