// Vitest: käynnistä testikanta ja aja migraatiot alusta kerran ennen kaikkia testejä
import { loadTestEnv } from './env.js';
import { startTestDb } from './test-db.js';

export default async function setup() {
  const db = await startTestDb(loadTestEnv());
  return () => db.stop();
}
