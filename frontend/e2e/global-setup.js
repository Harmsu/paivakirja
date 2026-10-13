// Käynnistä testikanta ja aja migraatiot alusta (backendin testityökaluilla)
import { loadTestEnv } from '../../backend/test/env.js';
import { startTestDb } from '../../backend/test/test-db.js';

export default async function globalSetup() {
  const db = await startTestDb(loadTestEnv());
  return () => db.stop();
}
