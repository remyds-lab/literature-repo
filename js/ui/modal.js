import { $, $$, escapeHtml, formatDate } from '../utils.js';
import { getItems, updateItem, addItem, deleteItem } from '../store.js';
import { toast } from './toast.js';
import { refreshCurrentPage } from '../router.js';

let editId = null;
let currentRating = 0;

const categoriesByGroup = {
  visual: ['Manga', 'Manhua', 'Manhwa'],
  written: ['Novela Web', 'LN', 'Literatura Clásica', 'Literatura Juvenil', 'Ciencia Ficción'],
  media: ['Serie', 'Película'],
};

function groupForCategory(category) {
  return Object.entries(categoriesByGroup).find(([, categories]) => categories.includes(category))?.[0] || 'visual';
}

function updateCategoryOptions(group, selectedCategory = '') {
  const select = $('#fCategory');
  if (!select) return;
  const categories = categoriesByGroup[group] || categoriesByGroup.visual;
  select.innerHTML = categories.map(category => `<option value="${category}">${category}</option>`).join('');
  select.value = categories.includes(selectedCategory) ? selectedCategory : categories[0];
}

function renderCommentHistory(item) {
  const history = $('#commentHistory');
  const list = $('#commentHistoryList');
  const count = $('#commentHistoryCount');
  if (!history || !list || !count) return;

  const comments = [...(item?.comments || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  history.hidden = comments.length === 0;
  count.textContent = comments.length ? `${comments.length}` : '';
  list.innerHTML = comments.map(comment => `
    <article class="comment-history-entry">
      <time datetime="${escapeHtml(comment.createdAt)}">${formatDate(comment.createdAt)}</time>
      <p>${escapeHtml(comment.text)}</p>
    </article>
  `).join('');
}

export function setupModal() {
  $('#modalClose')?.addEventListener('click', closeModal);
  $('#cancelModalBtn')?.addEventListener('click', closeModal);
  $('#itemModal')?.addEventListener('click', (e) => {
    if (e.target === $('#itemModal')) closeModal();
  });
  $('#itemForm')?.addEventListener('submit', handleSave);
  $('#fGroup')?.addEventListener('change', () => updateCategoryOptions($('#fGroup').value));
  $('#deleteItemBtn')?.addEventListener('click', handleDelete);

  // Star rating interaction
  const stars = $$('#starRating .star');
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.val);
      stars.forEach(s => {
        s.classList.toggle('hovered', parseInt(s.dataset.val) <= val);
      });
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('hovered'));
    });
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.val);
      currentRating = val;
      $('#fRating').value = val;
      stars.forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.val) <= val);
      });
    });
  });
}

export function openModal(item = null, prefill = null) {
  editId = null;
  const form = $('#itemForm');
  if (form) form.reset();
  
  currentRating = 0;
  $$('#starRating .star').forEach(s => { 
    s.classList.remove('active'); 
    s.classList.remove('hovered'); 
  });

  if (item) {
    // Editing existing item
    editId = item.id;
    $('#modalTitle').textContent = 'Editar Ítem';
    $('#fTitle').value = item.title || '';
    $('#fGroup').value = groupForCategory(item.category);
    updateCategoryOptions($('#fGroup').value, item.category);
    $('#fGenre').value = item.genre || '';
    $('#fStatus').value = item.status || 'Planeo Leer';
    $('#fDescription').value = item.description || '';
    $('#fChapters').value = item.chapters ?? '';
    $('#fPages').value = item.pages ?? '';
    renderCommentHistory(item);
    $('#fSourceUrl').value = item.sourceUrl || '';
    $('#fImageUrl').value = item.imageUrl || '';
    if (item.rating) {
      currentRating = item.rating;
      $('#fRating').value = item.rating;
      $$('#starRating .star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.val) <= item.rating);
      });
    }
    $('#deleteItemBtn').style.display = 'block';
  } else if (prefill) {
    // Adding from search result
    $('#modalTitle').textContent = 'Añadir a Biblioteca';
    $('#fTitle').value = prefill.title || '';
    $('#fGroup').value = prefill.group || groupForCategory(prefill.category);
    updateCategoryOptions($('#fGroup').value, prefill.category);
    $('#fGenre').value = prefill.genre || '';
    $('#fDescription').value = prefill.description || '';
    $('#fChapters').value = prefill.chapters ?? '';
    $('#fPages').value = prefill.pages ?? '';
    $('#fSourceUrl').value = prefill.sourceUrl || '';
    $('#fImageUrl').value = prefill.imageUrl || '';
    renderCommentHistory(null);
    $('#deleteItemBtn').style.display = 'none';
  } else {
    // New manual add
    $('#modalTitle').textContent = 'Nuevo Ítem';
    $('#fGroup').value = 'visual';
    updateCategoryOptions('visual', 'Manga');
    $('#fChapters').value = '';
    $('#fPages').value = '';
    $('#deleteItemBtn').style.display = 'none';
    renderCommentHistory(null);
  }

  $('#itemModal').classList.remove('hidden');
}

export function closeModal() {
  $('#itemModal').classList.add('hidden');
  editId = null;
}

function handleSave(e) {
  e.preventDefault();
  
  const titleVal = $('#fTitle').value.trim();
  if (!titleVal) return;

  const existing = editId ? getItems().find(i => i.id === editId) : null;
  const comment = $('#fComment').value.trim();
  const comments = [...(existing?.comments || [])];
  if (comment) {
    comments.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: comment,
      createdAt: new Date().toISOString(),
    });
  }

  const newItem = {
    ...(existing || {}),
    id: editId || Date.now().toString(),
    title: titleVal,
    category: $('#fCategory').value,
    chapters: $('#fChapters').value === '' ? null : Number($('#fChapters').value),
    pages: $('#fPages').value === '' ? null : Number($('#fPages').value),
    genre: $('#fGenre').value.trim(),
    status: $('#fStatus').value,
    description: $('#fDescription').value.trim(),
    rating: currentRating || null,
    comment: comment || existing?.comment || '',
    comments,
    sourceUrl: $('#fSourceUrl').value.trim(),
    imageUrl: $('#fImageUrl').value.trim(),
    dateUpdated: new Date().toISOString(),
  };

  if (editId) {
    newItem.dateAdded = existing?.dateAdded || new Date().toISOString();
    updateItem(editId, newItem);
    toast('Ítem actualizado', 'success');
  } else {
    newItem.dateAdded = new Date().toISOString();
    addItem(newItem);
    toast('Añadido a tu biblioteca', 'success');
  }

  closeModal();
  refreshCurrentPage();
}

function handleDelete() {
  if (!editId) return;
  if (!confirm('¿Eliminar este ítem de tu biblioteca?')) return;

  deleteItem(editId);
  closeModal();
  toast('Ítem eliminado', 'error');
  refreshCurrentPage();
}
