// GET /api/export — koko päiväkirja zip-tiedostona: data.json + kuvat.
// Sama malli kuin pyöräilysovelluksen CSV-viennissä: kirjautumisen takana oleva GET,
// Content-Disposition-otsake, frontend lataa blobina.
// data.json vastaa tietomallia (taulujen sarakenimet), jotta sen voi myöhemmin tuoda takaisin.
import { Router } from 'express';
import { ZipArchive } from 'archiver';
import { query } from '../db.js';
import { getObjectBuffer } from '../storage.js';

export const exportRouter = Router();

exportRouter.get('/', async (_req, res) => {
  const [entries, texts, photos, checkins] = await Promise.all([
    query('SELECT * FROM entries ORDER BY date'),
    query('SELECT * FROM text_blocks ORDER BY entry_id, sort_order, id'),
    query('SELECT * FROM photos ORDER BY entry_id, sort_order, id'),
    query('SELECT * FROM checkins ORDER BY entry_id, sort_order, id'),
  ]);

  const byId = new Map(entries.rows.map(e => [e.id, {
    date: e.date, created_at: e.created_at, updated_at: e.updated_at,
    text_blocks: [], photos: [], checkins: [],
  }]));
  for (const t of texts.rows) {
    byId.get(t.entry_id).text_blocks.push({ content: t.content, sort_order: t.sort_order });
  }
  for (const c of checkins.rows) {
    byId.get(c.entry_id).checkins.push({
      place_name: c.place_name, category: c.category,
      latitude: c.latitude, longitude: c.longitude, sort_order: c.sort_order,
    });
  }
  const files = [];
  for (const p of photos.rows) {
    const file = `photos/${p.object_key.split('/').slice(1).join('_')}`;
    files.push({ key: p.object_key, file });
    byId.get(p.entry_id).photos.push({
      file, caption: p.caption, width: p.width, height: p.height,
      sort_order: p.sort_order, created_at: p.created_at,
    });
  }

  const data = {
    format: 'paikka-ja-kuvapaivakirja-export',
    version: 1,
    exported_at: new Date().toISOString(),
    entries: [...byId.values()],
  };

  const filename = `paivakirja-${new Date().toISOString().slice(0, 10)}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

  // Kuvat ovat jo JPEG-pakattuja, joten zip-pakkausta ei kannata tehdä niille
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', err => { console.error('Vienti epäonnistui', err); res.destroy(err); });
  archive.pipe(res);
  archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });

  // Yksi kuva kerrallaan muistissa: odotetaan, että edellinen on kirjoitettu zipiin
  for (const f of files) {
    if (res.destroyed) return;
    const buf = await getObjectBuffer(f.key);
    const written = new Promise(resolve => archive.once('entry', resolve));
    archive.append(buf, { name: f.file, store: true });
    await written;
  }
  await archive.finalize();
});
