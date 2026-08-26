import { $, $$ } from '../utils.js';
import { toast } from './toast.js';

const THEME_KEY = 'mediaVault_theme';

export function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'midnight';
  document.body.className = `theme-${saved}`;
}

export function setupThemeSelector() {
  const btn = $('#themeToggleBtn');
  const dropdown = $('#themeDropdown');

  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    dropdown.classList.add('hidden');
  });

  $$('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.dataset.theme;
      document.body.className = `theme-${theme}`;
      localStorage.setItem(THEME_KEY, theme);
      dropdown.classList.add('hidden');
      toast('Tema cambiado a ' + theme.charAt(0).toUpperCase() + theme.slice(1), 'success');
    });
  });
}
