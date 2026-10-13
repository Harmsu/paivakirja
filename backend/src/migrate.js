// Yksinkertainen migraatioajuri: ajaa migrations/*.sql aakkosjärjestyksessä,
// kukin tiedosto vain kerran (kirjanpito taulussa schema_migrations).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// Palauttaa ajettujen tiedostojen nimet. Heittää virheen, jos jokin migraatio epäonnistuu.
export async function runMigrations(pool, log = console.log) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const applied = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      log('Ajettu:', f);
      applied.push(f);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`Migraatio epäonnistui: ${f}: ${e.message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}

// Komentoriviltä: npm run migrate
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { pool } = await import('./db.js');
  try {
    await runMigrations(pool);
  } catch (e) {
    console.error(e.message || e.code || e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
