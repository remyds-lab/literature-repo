const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const SESSION_COOKIE = 'mediavault_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const AUTH_SECRET = process.env.AUTH_SECRET || 'mediavault-dev-secret-change-me';
let dbInitialized = false;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash).split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function createSession(username) {
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + SESSION_MAX_AGE * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function getSession(req) {
  const cookie = req.headers.cookie || '';
  const token = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`))?.split('=').slice(1).join('=');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    INSERT INTO media_users (username, password_hash)
    VALUES ('caro', $1)
    ON CONFLICT (username) DO NOTHING;
  `, [hashPassword('1234')]);
}

module.exports = async function handler(req, res) {
  try {
    if (!dbInitialized) {
      await initDb();
      dbInitialized = true;
    }
    const action = req.query?.action || 'me';
    if (req.method === 'POST' && action === 'login') {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const result = await pool.query('SELECT username, password_hash FROM media_users WHERE username = $1', [username]);
      if (!result.rows[0] || !verifyPassword(password, result.rows[0].password_hash)) {
        return res.status(401).json({ error: 'Usuario o clave incorrectos.' });
      }
      setSessionCookie(res, createSession(username));
      return res.status(200).json({ username });
    }
    if (req.method === 'POST' && action === 'register') {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!/^[a-z0-9_-]{3,20}$/.test(username)) return res.status(400).json({ error: 'Usuario inválido.' });
      if (password.length < 4) return res.status(400).json({ error: 'La clave debe tener al menos 4 caracteres.' });
      await pool.query('INSERT INTO media_users (username, password_hash) VALUES ($1, $2)', [username, hashPassword(password)]);
      setSessionCookie(res, createSession(username));
      return res.status(201).json({ username });
    }
    if (req.method === 'POST' && action === 'logout') {
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      return res.status(200).json({ success: true });
    }
    if (req.method === 'GET' && action === 'me') {
      const session = getSession(req);
      return res.status(200).json({ username: session?.username || null });
    }
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ese usuario ya existe.' });
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Error del servidor.' });
  }
};
