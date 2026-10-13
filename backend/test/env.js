// Testiympäristön muuttujat tiedostosta .env.test. Käytetään sekä API-testeissä (Vitest)
// että selaintesteissä (Playwright käynnistää backendin näillä arvoilla).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export function assertTestDatabase(url) {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(`Testikannan nimen pitää päättyä _test (nyt "${name}"). Testejä ei ajeta.`);
  }
}

export function loadTestEnv() {
  const file = parseEnv(fs.readFileSync(path.join(here, '..', '.env.test'), 'utf8'));
  const env = { ...file };
  for (const k of Object.keys(file)) if (process.env[k] !== undefined) env[k] = process.env[k];
  assertTestDatabase(env.TEST_DATABASE_URL);
  return {
    ...env,
    DATABASE_URL: env.TEST_DATABASE_URL,
    APP_USERNAME: env.TEST_USERNAME,
    APP_PASSWORD_HASH: bcrypt.hashSync(env.TEST_PASSWORD, 4),
    LOCAL_STORAGE_DIR: path.join(os.tmpdir(), 'paivakirja-test-storage'),
    // Ei koskaan oikeaa Object Storagea testeissä
    S3_ENDPOINT: '', S3_BUCKET: '', S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: '',
    CORS_ORIGIN: env.CORS_ORIGIN || 'http://localhost:5174',
  };
}
