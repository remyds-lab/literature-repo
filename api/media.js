const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
});

// Ensure table exists
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_items (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

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

  if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT data FROM media_items');
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
      await client.query('DELETE FROM media_items');
      // Insert new rows
      const insertText = 'INSERT INTO media_items(id, data) VALUES($1, $2)';
      for (const item of items) {
        await client.query(insertText, [item.id, item]);
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
