// Testikanta: käynnistää kertakäyttöisen Postgresin (tai käyttää TEST_DATABASE_URL:ää),
// nollaa skeeman ja ajaa migraatiot alusta.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { runMigrations } from '../src/migrate.js';
import { assertTestDatabase } from './env.js';

export async function startTestDb(env) {
  const url = env.TEST_DATABASE_URL;
  assertTestDatabase(url);
  let embedded = null;
  if (env.TEST_PG_EMBEDDED !== 'false') {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const u = new URL(url);
    if (await portInUse(Number(u.port))) {
      throw new Error(`Testikannan portti ${u.port} on jo käytössä. Onko edellisen testiajon `
        + 'postgres.exe jäänyt käyntiin? Pysäytä se tai vaihda TEST_PG_PORT (.env.test).');
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paivakirja-test-pg-'));
    embedded = new EmbeddedPostgres({
      databaseDir: dir, user: u.username, password: u.password, port: Number(u.port),
      persistent: false, onLog: () => {},
      initdbFlags: ['--encoding=UTF8', '--locale=C'], // Windowsin oletus olisi WIN1252
    });
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase(u.pathname.slice(1));
  }
  await resetSchema(url);
  return { url, stop: async () => { if (embedded) await embedded.stop(); } };
}

export async function resetSchema(url) {
  assertTestDatabase(url);
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(pool, () => {});
  } finally {
    await pool.end();
  }
}

// Tyhjentää datan (skeema säilyy) ja paikalliset kuvatiedostot
export async function resetData(url, storageDir) {
  assertTestDatabase(url);
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await pool.query('TRUNCATE entries, favorite_places RESTART IDENTITY CASCADE');
  } finally {
    await pool.end();
  }
  if (storageDir) fs.rmSync(storageDir, { recursive: true, force: true });
}

function portInUse(port) {
  return new Promise(resolve => {
    const s = net.connect(port, '127.0.0.1');
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}
