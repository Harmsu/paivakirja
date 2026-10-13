// Yksittäisten tekstien, kuvien ja paikkojen muokkaus ja poisto.
import { Router } from 'express';
import { query } from '../db.js';
import { touchEntry, deleteIfEmpty, photoDto } from '../entries-data.js';
import { deleteObjects } from '../storage.js';

export const itemsRouter = Router();

const toNum = v => (v === null || v === undefined || v === '' ? null : Number(v));

// Validoi paikan kentät. Koordinaatit ovat valinnaisia, mutta aina pareittain.
export function cleanCheckin(body = {}) {
  const place_name = String(body.place_name ?? '').trim();
  if (!place_name) return { error: 'Paikan nimi puuttuu' };
  const category = String(body.category ?? '').trim() || null;
  const latitude = toNum(body.latitude);
  const longitude = toNum(body.longitude);
  if ((latitude === null) !== (longitude === null)) return { error: 'Anna sekä leveys- että pituusaste' };
  if (latitude !== null && !(Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)) {
    return { error: 'Virheelliset koordinaatit' };
  }
  return { place_name, category, latitude, longitude };
}

itemsRouter.put('/texts/:id', async (req, res) => {
  const content = String(req.body?.content ?? '').trim();
  if (!content) return res.status(400).json({ error: 'Teksti puuttuu' });
  const { rows } = await query(
    'UPDATE text_blocks SET content = $1 WHERE id = $2 RETURNING *', [content, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Ei löytynyt' });
  await touchEntry(rows[0].entry_id);
  res.json(rows[0]);
});

itemsRouter.delete('/texts/:id', async (req, res) => {
  const { rows } = await query('DELETE FROM text_blocks WHERE id = $1 RETURNING entry_id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Ei löytynyt' });
  await deleteIfEmpty(rows[0].entry_id);
  res.status(204).end();
});

itemsRouter.put('/checkins/:id', async (req, res) => {
  const c = cleanCheckin(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  const { rows } = await query(
    `UPDATE checkins SET place_name = $1, category = $2, latitude = $3, longitude = $4
     WHERE id = $5 RETURNING *`,
    [c.place_name, c.category, c.latitude, c.longitude, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Ei löytynyt' });
  await touchEntry(rows[0].entry_id);
  res.json(rows[0]);
});

itemsRouter.delete('/checkins/:id', async (req, res) => {
  const { rows } = await query('DELETE FROM checkins WHERE id = $1 RETURNING entry_id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Ei löytynyt' });
  await deleteIfEmpty(rows[0].entry_id);
  res.status(204).end();
});

itemsRouter.put('/photos/:id', async (req, res) => {
  const caption = String(req.body?.caption ?? '').trim() || null;
  const { rows } = await query(
    'UPDATE photos SET caption = $1 WHERE id = $2 RETURNING *', [caption, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Ei löytynyt' });
  await touchEntry(rows[0].entry_id);
  res.json(await photoDto(rows[0]));
});

itemsRouter.delete('/photos/:id', async (req, res) => {
  const { rows } = await query(
    'DELETE FROM photos WHERE id = $1 RETURNING entry_id, object_key, thumb_key', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Ei löytynyt' });
  await deleteObjects([rows[0].object_key, rows[0].thumb_key]);
  await deleteIfEmpty(rows[0].entry_id);
  res.status(204).end();
});
