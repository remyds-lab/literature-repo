import { escapeHtml } from '../utils.js';

export function getCategoryEmoji(cat) {
  const map = {
    'Manga': '📖', 'Manhua': '🇨🇳', 'Manhwa': '🇰🇷',
    'Novela Web': '🌐', 'LN': '📕', 'Literatura Clásica': '📜',
    'Literatura Juvenil': '📗', 'Ciencia Ficción': '🚀',
    'Serie': '📺', 'Película': '🎬'
  };
  return map[cat] || '📚';
}

export function renderItemCard(item) {
  const emoji = getCategoryEmoji(item.category);
  const imgHtml = item.imageUrl
    ? `<img class="item-card-img" src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.outerHTML='<div class=\\'item-card-img-placeholder\\'>${emoji}</div>'">`
    : `<div class="item-card-img-placeholder">${emoji}</div>`;

  return `
    <div class="item-card" data-id="${item.id}">
      ${imgHtml}
      <div class="item-card-body">
        <div class="item-card-title">${escapeHtml(item.title)}</div>
        <div class="item-card-meta">
          <span class="badge badge-cat">${item.category}</span>
          <span class="badge badge-status" data-status="${item.status}">${item.status}</span>
        </div>
        ${item.rating ? `<div class="item-card-rating">★ ${item.rating}/10</div>` : ''}
        ${item.comment ? `<div class="item-card-comment">${escapeHtml(item.comment)}</div>` : ''}
      </div>
    </div>
  `;
}
