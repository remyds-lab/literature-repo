import { $, $$ } from './utils.js';
import { renderHome } from './pages/home.js';
import { renderLibrary } from './pages/library.js';
import { renderStats } from './pages/stats.js';

export function setupRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function handleRoute() {
  const hash = location.hash.replace('#', '') || 'home';
  const pages = ['home', 'library', 'search', 'stats'];
  const pageName = pages.includes(hash) ? hash : 'home';

  $$('.page').forEach(p => p.classList.remove('page-active'));
  const targetPage = $(`#page-${pageName}`);
  if (targetPage) targetPage.classList.add('page-active');

  $$('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === pageName);
  });

  const navLinks = $('#navLinks');
  if (navLinks) navLinks.classList.remove('open');

  if (pageName === 'home') renderHome();
  if (pageName === 'library') renderLibrary();
  if (pageName === 'stats') renderStats();
}

export function refreshCurrentPage() {
  const hash = location.hash.replace('#', '') || 'home';
  if (hash === 'home') renderHome();
  if (hash === 'library') renderLibrary();
  if (hash === 'stats') renderStats();
}
