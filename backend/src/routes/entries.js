// Entryt päivämäärän mukaan: aikajana, yksittäinen päivä, tänä päivänä, lisäykset ja järjestys.
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool, query } from '../db.js';
import {
  isValidDate, ensureEntry, loadEntries, nextSortOrder, photoDto,
} from '../entries-data.js';
import { uploadSingle, processImage } from '../images.js';
import { putObject, deleteObjects, storageConfigured } from '../storage.js';
import { cleanCheckin } from './items.js';

export const entriesRouter = Router();

// GET /api/entries?before=YYYY-MM-DD&limit=20 — aikajana uusimmasta taaksepäin
entriesRouter.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const { before } = req.query;
  if (before && !isValidDate(before)) return res.status(400).json({ error: 'Virheellinen päivämäärä' });
  const entries = before
    ? await loadEntries('e.date < $1', [before], 'e.date DESC', `LIMIT ${limit}`)
    : await loadEntries('TRUE', [], 'e.date DESC', `LIMIT ${limit}`);
  res.json(entries);
});

// GET /api/entries/on-this-day?month=10&day=13 — sama päivä kaikilta vuosilta
entriesRouter.get('/on-this-day', async (req, res) => {
  const month = parseInt(req.query.month, 10);
  const day = parseInt(req.query.day, 10);
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) {
    return res.status(400).json({ error: 'Virheellinen päivä' });
  }
  res.json(await loadEntries(
    'EXTRACT(MONTH FROM e.date) = $1 AND EXTRACT(DAY FROM e.date) = $2', [month, day]
  ));
});

entriesRouter.param('date', (req, res, next, date) => {
  if (!isValidDate(date)) return res.status(400).json({ error: 'Virheellinen päivämäärä' });
  next();
});

// GET /api/entries/:date — päivän entry, tai tyhjä runko jos päivälle ei ole vielä mitään
entriesRouter.get('/:date', async (req, res) => {
  const [entry] = await loadEntries('e.date = $1', [req.params.date]);
  res.json(entry ?? { id: null, date: req.params.date, text_blocks: [], photos: [], checkins: [] });
});

// DELETE /api/entries/:date — koko päivä kuvineen
entriesRouter.delete('/:date', async (req, res) => {
  const { rows } = await query(
    `SELECT p.object_key, p.thumb_key FROM photos p JOIN entries e ON e.id = p.entry_id
     WHERE e.date = $1`,
    [req.params.date]
  );
  const { rowCount } = await query('DELETE FROM entries WHERE date = $1', [req.params.date]);
  if (!rowCount) return res.status(404).json({ error: 'Ei löytynyt' });
  await deleteObjects(rows.flatMap(r => [r.object_key, r.thumb_key]));
  res.status(204).end();
});

// POST /api/entries/:date/texts { content }
entriesRouter.post('/:date/texts', async (req, res) => {
  const content = String(req.body?.content ?? '').trim();
  if (!content) return res.status(400).json({ error: 'Teksti puuttuu' });
  const entryId = await ensureEntry(req.params.date);
  const { rows } = await query(
    'INSERT INTO text_blocks (entry_id, content, sort_order) VALUES ($1, $2, $3) RETURNING *',
    [entryId, content, await nextSortOrder('text_blocks', entryId)]
  );
  res.status(201).json(rows[0]);
});

// POST /api/entries/:date/checkins { place_name, category?, latitude?, longitude? }
entriesRouter.post('/:date/checkins', async (req, res) => {
  const c = cleanCheckin(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  const entryId = await ensureEntry(req.params.date);
  const { rows } = await query(
    `INSERT INTO checkins (entry_id, place_name, category, latitude, longitude, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [entryId, c.place_name, c.category, c.latitude, c.longitude,
      await nextSortOrder('checkins', entryId)]
  );
  res.status(201).json(rows[0]);
});

// POST /api/entries/:date/photos (multipart: file, caption?)
entriesRouter.post('/:date/photos', uploadSingle, async (req, res) => {
  if (!storageConfigured) return res.status(503).json({ error: 'Kuvatallennusta ei ole määritetty' });
  if (!req.file) return res.status(400).json({ error: 'Kuva puuttuu' });

  let img;
  try {
    img = await processImage(req.file.buffer);
  } catch {
    return res.status(400).json({ error: 'Kuvan käsittely epäonnistui, tarkista tiedosto' });
  }

  const name = `${req.params.date}/${randomUUID()}.jpg`;
  const objectKey = `photos/${name}`;
  const thumbKey = `thumbs/${name}`;
  await putObject(objectKey, img.main);
  await putObject(thumbKey, img.thumb);

  try {
    const entryId = await ensureEntry(req.params.date);
    const caption = String(req.body?.caption ?? '').trim() || null;
    const { rows } = await query(
      `INSERT INTO photos (entry_id, object_key, thumb_key, caption, width, height, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [entryId, objectKey, thumbKey, caption, img.width, img.height,
        await nextSortOrder('photos', entryId)]
    );
    res.status(201).json(await photoDto(rows[0]));
  } catch (e) {
    await deleteObjects([objectKey, thumbKey]).catch(() => {});
    throw e;
  }
});

// PUT /api/entries/:date/order { text_blocks?: [id], photos?: [id], checkins?: [id] }
entriesRouter.put('/:date/order', async (req, res) => {
  const { rows } = await query('SELECT id FROM entries WHERE date = $1', [req.params.date]);
  if (!rows.length) return res.status(404).json({ error: 'Ei löytynyt' });
  const entryId = rows[0].id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of ['text_blocks', 'photos', 'checkins']) {
      const ids = req.body?.[table];
      if (!Array.isArray(ids)) continue;
      for (const [i, id] of ids.entries()) {
        await client.query(
          `UPDATE ${table} SET sort_order = $1 WHERE id = $2 AND entry_id = $3`,
          [i, id, entryId]
        );
      }
    }
    await client.query('UPDATE entries SET updated_at = now() WHERE id = $1', [entryId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.status(204).end();
});
