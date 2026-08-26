import { $, $$, escapeHtml } from '../utils.js';
import { openModal } from '../ui/modal.js';

let currentSource = 'manga'; // manga | comics | movies | books

export function setupSearch() {
  $$('.src-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.src-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSource = tab.dataset.source;
      updateSearchModes();
      const resultsContainer = $('#searchResults');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="search-placeholder">
            <span class="placeholder-icon">🔎</span>
            <p>Escribe un título y presiona buscar.</p>
          </div>`;
      }
    });
  });

  updateSearchModes();

  $('#extSearchBtn')?.addEventListener('click', doExternalSearch);
  $('#extSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doExternalSearch();
  });
}

async function doExternalSearch() {
  const query = $('#extSearch')?.value.trim();
  if (!query) return;

  const container = $('#searchResults');
  if (!container) return;
  
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const mode = $('#searchMode')?.value || 'title';
    const res = await fetch(`/api/search-${currentSource}?q=${encodeURIComponent(query)}&mode=${mode}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderSearchResults(data);
  } catch (err) {
    console.error('Search error:', err);
    container.innerHTML = `
      <div class="search-placeholder">
        <span class="placeholder-icon">⚠️</span>
        <p>Error al buscar. Intenta de nuevo más tarde.</p>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem;">${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function updateSearchModes() {
  const select = $('#searchMode');
  if (!select) return;
  const modes = currentSource === 'movies'
    ? [['title', 'Título'], ['director', 'Director'], ['actor', 'Actor']]
    : currentSource === 'comics'
      ? [['title', 'Título'], ['author', 'Autor']]
    : currentSource === 'books'
      ? [['title', 'Título'], ['author', 'Autor']]
      : [['title', 'Título'], ['author', 'Autor']];
  select.innerHTML = modes.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
}

function renderSearchResults(data) {
  const container = $('#searchResults');
  if (!container) return;

  if (!data.results || data.results.length === 0) {
    container.innerHTML = `
      <div class="search-placeholder">
        <span class="placeholder-icon">🤷</span>
        <p>No se encontraron resultados.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="search-results-grid">
      ${data.results.map((r, i) => `
        <div class="result-card" data-index="${i}">
          <div class="result-card-media">
            ${r.image ? `<img class="result-card-img" src="${r.image}" alt="${escapeHtml(r.title)}" loading="lazy" onerror="this.outerHTML='<div class=\'result-card-img-placeholder\'>${getResultEmoji(r.type)}</div>'">` : `<div class="result-card-img-placeholder">${getResultEmoji(r.type)}</div>`}
          </div>
          <div class="result-card-info">
            <div class="result-card-title">${escapeHtml(r.title)}</div>
            <div class="result-card-desc">${escapeHtml(r.description || r.year || '')}</div>
            <div class="result-card-actions">
              <button class="btn btn-primary btn-sm add-result-btn" data-index="${i}">＋ Añadir</button>
              ${r.url ? `<a href="${r.url}" target="_blank" class="btn btn-outline btn-sm">Ver fuente ↗</a>` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.add-result-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      const result = data.results[idx];
      addFromSearchResult(result);
    });
  });
}

function getResultEmoji(type) {
  if (type === 'Movie') return '\u{1F3AC}';
  if (type === 'Series') return '\u{1F4FA}';
  if (type === 'Manga') return '\u{1F4D6}';
  if (type === 'Comic') return '\u{1F9B8}';
  return '\u{1F4DA}';
}

function addFromSearchResult(result) {
  const prefill = {
    title: result.title || '',
    category: guessCategory(result),
    group: result.group || guessGroup(result),
    genre: result.genre || '',
    description: result.description || '',
    chapters: result.chapters ?? null,
    currentChapter: result.currentChapter ?? null,
    imageUrl: result.image || '',
    sourceUrl: result.url || '',
  };
  openModal(null, prefill);
}

function guessGroup(result) {
  if (currentSource === 'movies') return 'media';
  if (currentSource === 'books') return 'written';
  return 'visual';
}

function guessCategory(result) {
  if (currentSource === 'comics') return 'Cómic';
  if (currentSource === 'manga') {
    const type = (result.type || '').toLowerCase();
    if (type.includes('manhua')) return 'Manhua';
    if (type.includes('manhwa')) return 'Manhwa';
    if (type.includes('novel')) return 'Novela Web';
    return 'Manga';
  }
  if (currentSource === 'movies') {
    const type = (result.type || '').toLowerCase();
    if (type.includes('series') || type === 'series') return 'Serie';
    return 'Película';
  }
  if (currentSource === 'books') {
    return 'Literatura Clásica';
  }
  return 'Manga';
}
