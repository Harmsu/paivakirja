// API-testien apurit. Ympäristö on asetettu vitest.config.js:ssä ennen sovelluksen tuontia.
import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/db.js';
import { resetData } from './test-db.js';

export { app, pool };
export const api = () => request(app);

export async function reset() {
  await resetData(process.env.DATABASE_URL, process.env.LOCAL_STORAGE_DIR);
}

let cachedToken = null;
export async function token() {
  if (cachedToken) return cachedToken;
  const res = await api().post('/api/auth/login')
    .send({ username: process.env.TEST_USERNAME, password: process.env.TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`Kirjautuminen epäonnistui: ${res.status}`);
  cachedToken = res.body.token;
  return cachedToken;
}

// Kirjautuneet pyynnöt: authed().get('/api/...')
export async function authed() {
  const t = await token();
  const r = api();
  const wrap = m => (path) => r[m](path).set('Authorization', `Bearer ${t}`);
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), delete: wrap('delete') };
}

// Sovitin seed.js:lle
export async function seedClient() {
  const a = await authed();
  const check = (res, path) => {
    if (res.status >= 300) throw new Error(`${path}: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
  };
  return {
    post: async (path, body) => check(await a.post(path).send(body), path),
    upload: async (path, f) => check(
      await a.post(path).attach('file', f.buffer, { filename: f.name, contentType: f.mimeType }), path
    ),
  };
}

export const countRows = async table => Number((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
