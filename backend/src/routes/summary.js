// Koonnit kuukausi-, vuosi- ja tänä päivänä -näkymille sekä karttapisteet.
import { Router } from 'express';
import { query } from '../db.js';
import { isValidDate } from '../entries-data.js';
import { objectUrl } from '../storage.js';

export const summaryRouter = Router();

// GET /api/summary/days?from=&to=  tai  ?month=10 (kaikki vuodet)
// Päiväkohtaiset määrät + ensimmäisen kuvan pienoiskuva + paikkojen nimet.
summaryRouter.get('/days', async (req, res) => {
  const { from, to } = req.query;
  const month = parseInt(req.query.month, 10);
  let where; let params;
  if (month >= 1 && month <= 12) {
    where = 'EXTRACT(MONTH FROM e.date) = $1'; params = [month];
  } else if (isValidDate(from) && isValidDate(to)) {
    where = 'e.date BETWEEN $1 AND $2'; params = [from, to];
  } else {
    return res.status(400).json({ error: 'Anna from ja to, tai month' });
  }
  const { rows } = await query(
    `SELECT e.date,
       (SELECT count(*)::int FROM text_blocks t WHERE t.entry_id = e.id) AS texts,
       (SELECT count(*)::int FROM photos p WHERE p.entry_id = e.id) AS photos,
       (SELECT count(*)::int FROM checkins c WHERE c.entry_id = e.id) AS checkins,
       (SELECT p.thumb_key FROM photos p WHERE p.entry_id = e.id ORDER BY p.sort_order, p.id LIMIT 1) AS thumb_key,
       (SELECT array_agg(c.place_name ORDER BY c.sort_order, c.id) FROM checkins c WHERE c.entry_id = e.id) AS places,
       (SELECT left(t.content, 140) FROM text_blocks t WHERE t.entry_id = e.id ORDER BY t.sort_order, t.id LIMIT 1) AS excerpt
     FROM entries e WHERE ${where} ORDER BY e.date`,
    params
  );
  for (const r of rows) {
    r.thumb_url = r.thumb_key ? await objectUrl(r.thumb_key) : null;
    delete r.thumb_key;
    r.places ??= [];
  }
  res.json(rows);
});

// GET /api/summary/map?from=&to= — vain paikat, joilla on koordinaatit
summaryRouter.get('/map', async (req, res) => {
  const { from, to } = req.query;
  const conds = ['c.latitude IS NOT NULL', 'c.longitude IS NOT NULL'];
  const params = [];
  if (from) {
    if (!isValidDate(from)) return res.status(400).json({ error: 'Virheellinen päivämäärä' });
    params.push(from); conds.push(`e.date >= $${params.length}`);
  }
  if (to) {
    if (!isValidDate(to)) return res.status(400).json({ error: 'Virheellinen päivämäärä' });
    params.push(to); conds.push(`e.date <= $${params.length}`);
  }
  const { rows } = await query(
    `SELECT c.id, c.place_name, c.category, c.latitude, c.longitude, e.date
     FROM checkins c JOIN entries e ON e.id = c.entry_id
     WHERE ${conds.join(' AND ')} ORDER BY e.date DESC, c.sort_order`,
    params
  );
  res.json(rows);
});
