import { $, escapeHtml, formatDate } from '../utils.js';
import { getItems } from '../store.js';

export function renderStats() {
  renderCategoryChart();
  renderStatusChart();
  renderTopRated();
  renderTimeline();
}

function renderCategoryChart() {
  const container = $('#chartCategory');
  if (!container) return;
  const items = getItems();
  const counts = {};
  items.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1);

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay datos aún.</p>';
    return;
  }

  container.innerHTML = sorted.map(([cat, count]) => `
    <div class="chart-bar-row">
      <span class="chart-bar-label">${cat}</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width: ${(count / max * 100)}%">${count}</div>
      </div>
    </div>
  `).join('');
}

function renderStatusChart() {
  const container = $('#chartStatus');
  if (!container) return;
  const items = getItems();
  const counts = {};
  items.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1);

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay datos aún.</p>';
    return;
  }

  container.innerHTML = sorted.map(([status, count]) => `
    <div class="chart-bar-row">
      <span class="chart-bar-label">${status}</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width: ${(count / max * 100)}%">${count}</div>
      </div>
    </div>
  `).join('');
}

function renderTopRated() {
  const container = $('#topRatedList');
  if (!container) return;
  const items = getItems();
  const rated = items.filter(i => i.rating).sort((a, b) => b.rating - a.rating).slice(0, 8);

  if (rated.length === 0) {
    container.innerHTML = '<p class="empty-state">Aún no hay puntuaciones.</p>';
    return;
  }

  container.innerHTML = rated.map((item, i) => `
    <div class="top-item">
      <span class="top-rank">#${i + 1}</span>
      <span class="top-title">${escapeHtml(item.title)}</span>
      <span class="top-rating">★ ${item.rating}</span>
    </div>
  `).join('');
}

function renderTimeline() {
  const container = $('#timeline');
  if (!container) return;
  const items = getItems();
  const recent = [...items].sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)).slice(0, 10);

  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay actividad reciente.</p>';
    return;
  }

  container.innerHTML = recent.map(i => `
    <div class="timeline-item">
      <span class="timeline-dot"></span>
      <div class="timeline-info">
        <span class="timeline-title">${escapeHtml(i.title)} — ${i.category}</span>
        <span class="timeline-date">${formatDate(i.dateAdded)}</span>
      </div>
    </div>
  `).join('');
}
