import { $, escapeHtml } from '../utils.js';

export function toast(msg, type = 'success') {
  const container = $('#toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'success' ? '✅' : '❌'} ${escapeHtml(msg)}`;
  container.appendChild(el);
  setTimeout(() => { 
    el.style.opacity = '0'; 
    setTimeout(() => el.remove(), 300); 
  }, 3000);
}
