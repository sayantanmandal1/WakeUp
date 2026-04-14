const { Pool } = require("pg");

// SECURITY_NOTE: Connection string is read from environment variable.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS websites (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        last_pinged_at TIMESTAMPTZ,
        last_status INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("[DB] Table 'websites' ready");
  } finally {
    client.release();
  }
}

async function getAllWebsites() {
  const { rows } = await pool.query(
    "SELECT id, url, status, last_pinged_at, last_status FROM websites ORDER BY created_at DESC"
  );
  return rows;
}

async function addWebsite(url) {
  const { rows } = await pool.query(
    "INSERT INTO websites (url) VALUES ($1) RETURNING id, url, status",
    [url]
  );
  return rows[0];
}

async function deleteWebsite(id) {
  await pool.query("DELETE FROM websites WHERE id = $1", [id]);
}

async function toggleWebsite(id, newStatus) {
  await pool.query("UPDATE websites SET status = $1 WHERE id = $2", [
    newStatus,
    id,
  ]);
}

async function bulkUpdatePingStatus(updates) {
  if (updates.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const u of updates) {
      await client.query(
        "UPDATE websites SET last_pinged_at = NOW(), last_status = $1 WHERE id = $2",
        [u.status, u.id]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDB,
  getAllWebsites,
  addWebsite,
  deleteWebsite,
  toggleWebsite,
  bulkUpdatePingStatus,
};
