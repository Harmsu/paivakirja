// Suosikkipaikat. Käyttökerrat kasvavat, kun checkin tallennetaan suosikista (favorite_id
// checkinin POST/PUT-pyynnössä), ks. markFavoriteUsed.
import { Router } from 'express';
import { query } from '../db.js';
import { cleanPlace } from './items.js';
import { validIdParam } from '../entries-data.js';

export const favoritesRouter = Router();
favoritesRouter.param('id', validIdParam);

const UNIQUE_VIOLATION = '23505';
// Kerrotaan olemassa olevan suosikin nimi sellaisena kuin se on tallennettu
async function duplicate(res, name) {
  const { rows } = await query('SELECT name FROM favorite_places WHERE lower(name) = lower($1)', [name]);
  res.status(409).json({ error: `${rows[0]?.name ?? name} on jo suosikeissa` });
}

favoritesRouter.get('/', async (_req, res) => {
  const { rows } = await query(
    'SELECT * FROM favorite_places ORDER BY use_count DESC, lower(name), id'
  );
  res.json(rows);
});

favoritesRouter.post('/', async (req, res) => {
  const f = cleanPlace(req.body?.name, req.body);
  if (f.error) return res.status(400).json({ error: f.error });
  try {
    const { rows } = await query(
      `INSERT INTO favorite_places (name, category, latitude, longitude)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [f.name, f.category, f.latitude, f.longitude]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === UNIQUE_VIOLATION) return duplicate(res, f.name);
    throw e;
  }
});

favoritesRouter.put('/:id', async (req, res) => {
  const f = cleanPlace(req.body?.name, req.body);
  if (f.error) return res.status(400).json({ error: f.error });
  try {
    const { rows } = await query(
      `UPDATE favorite_places SET name = $1, category = $2, latitude = $3, longitude = $4
       WHERE id = $5 RETURNING *`,
      [f.name, f.category, f.latitude, f.longitude, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ei löytynyt' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === UNIQUE_VIOLATION) return duplicate(res, f.name);
    throw e;
  }
});

favoritesRouter.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM favorite_places WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Ei löytynyt' });
  res.status(204).end();
});
