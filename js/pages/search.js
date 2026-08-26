import { $, $$, escapeHtml } from '../utils.js';
import { openModal } from '../ui/modal.js';

let currentSource = 'manga'; // manga | movies | books

export function setupSearch() {
  $$('.src-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.src-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSource = tab.dataset.source;
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
    const res = await fetch(`/api/search-${currentSource}?q=${encodeURIComponent(query)}`);
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
          ${r.image ? `<img class="result-card-img" src="${r.image}" alt="${escapeHtml(r.title)}" loading="lazy" onerror="this.style.display='none'">` : ''}
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

function addFromSearchResult(result) {
  const prefill = {
    title: result.title || '',
    category: guessCategory(result),
    imageUrl: result.image || '',
    sourceUrl: result.url || '',
  };
  openModal(null, prefill);
}

function guessCategory(result) {
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
