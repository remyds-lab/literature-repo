const SESSION_KEY = 'mediaVault_session';
const LEGACY_ITEMS_KEY = 'mediaVault_items';

export function getCurrentUser() {
  return localStorage.getItem(SESSION_KEY) || '';
}

export function getUserItemsKey(username = getCurrentUser()) {
  return `mediaVault_items:${username.toLowerCase()}`;
}

function migrateLegacyLibrary() {
  const userKey = getUserItemsKey('caro');
  if (localStorage.getItem(userKey) !== null) return;
  const legacyItems = localStorage.getItem(LEGACY_ITEMS_KEY);
  if (legacyItems !== null) localStorage.setItem(userKey, legacyItems);
}

export async function login(username, password) {
  try {
    const response = await fetch('/api/auth?action=login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data.error || 'No se pudo iniciar sesión.' };
    migrateLegacyLibrary();
    localStorage.setItem(SESSION_KEY, data.username);
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor.' };
  }
}

export async function register(username, password) {
  try {
    const response = await fetch('/api/auth?action=register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data.error || 'No se pudo crear la cuenta.' };
    localStorage.setItem(SESSION_KEY, data.username);
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor.' };
  }
}

export async function logout() {
  await fetch('/api/auth?action=logout', { method: 'POST' });
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

export async function setupAuth() {
  const authScreen = document.querySelector('#authScreen');
  const appShell = document.querySelector('#appShell');
  const form = document.querySelector('#authForm');
  const usernameInput = document.querySelector('#authUsername');
  const passwordInput = document.querySelector('#authPassword');
  const authSubmit = document.querySelector('#authSubmit');
  const authSwitch = document.querySelector('#authSwitch');
  const authMessage = document.querySelector('#authMessage');
  const logoutButton = document.querySelector('#logoutBtn');
  let registerMode = false;

  const render = () => {
      const loggedIn = Boolean(getCurrentUser());
    authScreen?.classList.toggle('hidden', loggedIn);
    appShell?.classList.toggle('hidden', !loggedIn);
    if (loggedIn) document.body.classList.add('authenticated');
    authSubmit.textContent = registerMode ? 'Crear cuenta' : 'Entrar';
    authSwitch.textContent = registerMode ? 'Ya tengo una cuenta' : 'Crear una cuenta';
    document.querySelector('#authTitle').textContent = registerMode ? 'Crear cuenta' : 'Bienvenido';
    document.querySelector('#authSubtitle').textContent = registerMode
      ? 'Guarda tu biblioteca en un espacio personal.'
      : 'Entra para continuar con tu biblioteca.';
  };

  authSwitch?.addEventListener('click', () => {
    registerMode = !registerMode;
    authMessage.textContent = '';
    form.reset();
    render();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await (registerMode
      ? register(usernameInput.value, passwordInput.value)
      : login(usernameInput.value, passwordInput.value));
    if (!result.ok) {
      authMessage.textContent = result.error;
      authMessage.className = 'auth-message error';
      return;
    }
    window.location.reload();
  });

  logoutButton?.addEventListener('click', logout);
  if (getCurrentUser()) {
    try {
      const response = await fetch('/api/auth?action=me');
      if (!response.ok || !(await response.json()).username) localStorage.removeItem(SESSION_KEY);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }
  render();
  return Boolean(getCurrentUser());
}
