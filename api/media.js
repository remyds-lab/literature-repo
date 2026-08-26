const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
});
const AUTH_SECRET = process.env.AUTH_SECRET || 'mediavault-dev-secret-change-me';

// Ensure table exists
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_items (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      username TEXT NOT NULL DEFAULT 'caro'
    );
  `);
  await pool.query("ALTER TABLE media_items ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT 'caro';");
};

function getUsername(req) {
  const token = (req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith('mediavault_session='))?.split('=').slice(1).join('=');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.exp > Date.now() ? session.username : null;
  } catch {
    return null;
  }
}

let dbInitialized = false;

module.exports = async function handler(req, res) {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch (e) {
      console.error('DB init error:', e);
    }
  }

  const username = getUsername(req);
  if (!username) return res.status(401).json({ error: 'Autenticación requerida.' });

  if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT data FROM media_items WHERE username = $1', [username]);
      const items = result.rows.map(r => r.data);
      res.status(200).json(items);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  } else if (req.method === 'PUT') {
    const items = req.body; // expect array of objects
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Expected array of items' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Delete existing rows
      await client.query('DELETE FROM media_items WHERE username = $1', [username]);
      const insertText = 'INSERT INTO media_items(id, data, username) VALUES($1, $2, $3)';
      for (const item of items) {
        await client.query(insertText, [item.id, item, username]);
      }
      await client.query('COMMIT');
      res.status(200).json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    } finally {
      client.release();
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
