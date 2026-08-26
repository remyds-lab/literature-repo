import { $, $$ } from '../utils.js';
import { getItems } from '../store.js';
import { renderItemCard } from '../ui/card.js';
import { openModal } from '../ui/modal.js';

let currentCat = '';
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

function updateCategoryTabs() {
  $$('.cat-tab').forEach(tab => {
    const belongsToGroup = !tab.dataset.group || currentGroup === '' || tab.dataset.group === currentGroup;
    tab.hidden = !belongsToGroup;
  });
}

export function setupLibrary() {
  $$('.library-group-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.library-group-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentGroup = tab.dataset.group;
      currentCat = '';
      $$('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === ''));
      updateCategoryTabs();
      renderLibrary();
    });
  });

  $$('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCat = tab.dataset.cat;
      currentGroup = '';
      $$('.library-group-tab').forEach(t => t.classList.toggle('active', t.dataset.group === ''));
      updateCategoryTabs();
      renderLibrary();
    });
  });

  updateCategoryTabs();

  $('#libSearch')?.addEventListener('input', renderLibrary);
  $('#libStatusFilter')?.addEventListener('change', renderLibrary);
  $('#libSortBy')?.addEventListener('change', renderLibrary);
  $('#manualAddBtn')?.addEventListener('click', () => openModal());
}

export function renderLibrary() {
  const items = getItems();
  const query = ($('#libSearch')?.value || '').toLowerCase();
  const statusFilter = $('#libStatusFilter')?.value || '';
  const sortBy = $('#libSortBy')?.value || 'dateAdded';

  let filtered = items.filter(i => {
    const matchTitle = i.title.toLowerCase().includes(query);
    const matchCat = currentCat === '' || i.category === currentCat;
    const matchGroup = currentGroup === '' || categoryGroups[i.category] === currentGroup;
    const matchStatus = statusFilter === '' || i.status === statusFilter;
    return matchTitle && matchCat && matchGroup && matchStatus;
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
