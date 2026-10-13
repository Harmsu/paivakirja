// Suorituskyky: 500 entryä, 2 000 kuvaa ja 2 000 paikkaa. Vasteajat kirjataan
// tiedostoon test-results/perf.json raporttia varten. Raja on väljä (vain selvät regressiot).
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { authed, reset, pool } from './helpers.js';

describe('Suorituskyky', () => {
  let a;
  beforeAll(async () => {
    await reset();
    a = await authed();
    // Data suoraan SQL:llä (kuvatiedostoja ei tarvita mittaukseen)
    await pool.query(`INSERT INTO entries (date)
      SELECT DATE '2026-12-31' - g FROM generate_series(0, 499) g`);
    await pool.query(`INSERT INTO photos (entry_id, object_key, thumb_key, caption, width, height, sort_order)
      SELECT e.id, 'photos/x/' || e.id || '-' || n || '.jpg', 'thumbs/x/' || e.id || '-' || n || '.jpg',
             'kuva ' || n, 1600, 1067, n
      FROM entries e CROSS JOIN generate_series(0, 3) n`);
    await pool.query(`INSERT INTO checkins (entry_id, place_name, category, latitude, longitude, sort_order)
      SELECT e.id, 'Paikka ' || (e.id % 50), 'kahvila', 60 + (e.id % 50) * 0.1, 24 + n * 0.1, n
      FROM entries e CROSS JOIN generate_series(0, 3) n`);
    await pool.query("INSERT INTO text_blocks (entry_id, content, sort_order) SELECT id, 'Teksti ' || id, 0 FROM entries");
  });

  it('vasteajat', async () => {
    const queries = {
      'päivä-näkymä (15 entryä)': '/api/entries?limit=15',
      'päivä-näkymä, vanha sivu': '/api/entries?limit=15&before=2025-11-01',
      'yksittäinen päivä': '/api/entries/2026-06-15',
      'kuukausi-koonti': '/api/summary/days?from=2026-06-01&to=2026-06-30',
      'vuosi-koonti': '/api/summary/days?from=2026-01-01&to=2026-12-31',
      'tänä päivänä (kuukausi)': '/api/summary/days?month=6',
      'kartta (kaikki 2 000)': '/api/summary/map',
    };
    const results = {};
    for (const [name, url] of Object.entries(queries)) {
      await a.get(url); // lämmitys
      const times = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        const r = await a.get(url);
        times.push(performance.now() - t0);
        expect(r.status).toBe(200);
      }
      times.sort((x, y) => x - y);
      results[name] = { mediaani_ms: Math.round(times[2]), max_ms: Math.round(times[4]) };
    }
    const map = (await a.get('/api/summary/map')).body;
    expect(map).toHaveLength(2000);
    const dir = path.resolve('test-results');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'perf.json'), JSON.stringify(results, null, 2));
    console.table(results);
    for (const r of Object.values(results)) expect(r.mediaani_ms).toBeLessThan(1500);
  });
});
