import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import pg from 'pg';

// Ajetaan oikea palvelinprosessi, jotta nähdään kaatuuko se (testiprosessissa virhe ei näkyisi)
describe('Vikasietoisuus', () => {
  it('backend ei kaadu, kun tietokanta katkaisee yhteydet, ja toipuu', async () => {
    const port = 3199;
    const child = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'pipe' });
    let exited = false;
    child.on('exit', () => { exited = true; });
    const base = `http://localhost:${port}`;
    try {
      for (let i = 0; i < 50; i++) {
        try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
        await new Promise(r => setTimeout(r, 100));
      }
      expect((await fetch(`${base}/health`)).status).toBe(200);
      // Katkaistaan kaikki muut yhteydet testikantaan (kuten Postgresin uudelleenkäynnistys)
      const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await admin.connect();
      await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                         WHERE datname = current_database() AND pid <> pg_backend_pid()`);
      await admin.end();
      await new Promise(r => setTimeout(r, 500));
      expect(exited, 'palvelinprosessi kaatui').toBe(false);
      expect((await fetch(`${base}/health`)).status).toBe(200);
    } finally {
      child.kill();
    }
  });
});
