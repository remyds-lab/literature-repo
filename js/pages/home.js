import { $, $$ } from '../utils.js';
import { getItems } from '../store.js';
import { animateCounter } from '../utils.js';
import { renderItemCard } from '../ui/card.js';
import { openModal } from '../ui/modal.js';

export function renderHome() {
  const items = getItems();
  
  // Stats
  const total = items.length;
  const active = items.filter(i => ['Viendo','Leyendo'].includes(i.status)).length;
  const completed = items.filter(i => ['Visto','Leído'].includes(i.status)).length;
  const rated = items.filter(i => i.rating);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length).toFixed(1)
    : '—';

  animateCounter('statTotal', total);
  animateCounter('statActive', active);
  animateCounter('statCompleted', completed);
  
  const avgRatingEl = $('#statAvgRating');
  if (avgRatingEl) avgRatingEl.textContent = avgRating;

  // Recent items
  const recent = [...items].sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)).slice(0, 6);
  const container = $('#recentItems');
  
  if (!container) return;

  if (recent.length === 0) {
    container.innerHTML = `<p class="empty-state">Aún no hay ítems. <a href="#search" class="link-accent">¡Empieza a añadir!</a></p>`;
    return;
  }
  
  container.innerHTML = recent.map(i => renderItemCard(i)).join('');
  
  container.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const item = getItems().find(i => i.id === id);
      if (item) openModal(item);
    });
  });
}
