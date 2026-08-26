import { $ } from '../utils.js';

export function setupNavbar() {
  const hamburger = $('#hamburger');
  const navLinks = $('#navLinks');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }
}
