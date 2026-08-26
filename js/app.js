import { loadItems, loadFromBackend } from './store.js';
import { loadTheme, setupThemeSelector } from './ui/theme.js';
import { setupNavbar } from './ui/navbar.js';
import { setupModal } from './ui/modal.js';
import { setupLibrary } from './pages/library.js';
import { setupSearch } from './pages/search.js';
import { setupRouter, refreshCurrentPage } from './router.js';

document.addEventListener('DOMContentLoaded', async () => {
  loadItems();
  loadTheme();
  setupNavbar();
  setupThemeSelector();
  setupLibrary();
  setupSearch();
  setupModal();
  setupRouter();

  await loadFromBackend();
  refreshCurrentPage();
});
