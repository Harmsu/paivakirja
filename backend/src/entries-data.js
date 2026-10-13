// Yhteiset apurit: entryjen haku lapsineen, entryn varmistus päivälle, tyhjän entryn siivous.
import { query } from './db.js';
import { objectUrl } from './storage.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Palauttaa päivän entryn id:n, luo entryn jos sitä ei vielä ole (yksi entry per päivä).
export async function ensureEntry(date) {
  const { rows } = await query(
    `INSERT INTO entries (date) VALUES ($1)
     ON CONFLICT (date) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [date]
  );
  return rows[0].id;
}

export const touchEntry = entryId =>
  query('UPDATE entries SET updated_at = now() WHERE id = $1', [entryId]);

// Poistaa entryn, jos siihen ei jäänyt yhtään tekstiä, kuvaa tai paikkaa.
export const deleteIfEmpty = entryId =>
  query(
    `DELETE FROM entries e WHERE e.id = $1
       AND NOT EXISTS (SELECT 1 FROM text_blocks WHERE entry_id = e.id)
       AND NOT EXISTS (SELECT 1 FROM photos WHERE entry_id = e.id)
       AND NOT EXISTS (SELECT 1 FROM checkins WHERE entry_id = e.id)`,
    [entryId]
  );

export async function nextSortOrder(table, entryId) {
  // table tulee aina koodista, ei käyttäjältä
  const { rows } = await query(
    `SELECT COALESCE(MAX(sort_order) + 1, 0) AS n FROM ${table} WHERE entry_id = $1`,
    [entryId]
  );
  return rows[0].n;
}

export async function photoDto(p) {
  return {
    id: p.id,
    caption: p.caption,
    sort_order: p.sort_order,
    width: p.width,
    height: p.height,
    url: await objectUrl(p.object_key),
    thumb_url: await objectUrl(p.thumb_key),
  };
}

// Hakee entryt annetulla ehdolla ja liittää niihin tekstit, kuvat ja paikat.
export async function loadEntries(whereSql, params, orderSql = 'e.date DESC', limitSql = '') {
  const { rows: entries } = await query(
    `SELECT e.id, e.date, e.created_at, e.updated_at FROM entries e
     WHERE ${whereSql} ORDER BY ${orderSql} ${limitSql}`,
    params
  );
  if (!entries.length) return [];
  const ids = entries.map(e => e.id);
  const [texts, photos, checkins] = await Promise.all([
    query('SELECT * FROM text_blocks WHERE entry_id = ANY($1) ORDER BY sort_order, id', [ids]),
    query('SELECT * FROM photos WHERE entry_id = ANY($1) ORDER BY sort_order, id', [ids]),
    query('SELECT * FROM checkins WHERE entry_id = ANY($1) ORDER BY sort_order, id', [ids]),
  ]);
  const byId = new Map(entries.map(e => [e.id, { ...e, text_blocks: [], photos: [], checkins: [] }]));
  for (const t of texts.rows) byId.get(t.entry_id).text_blocks.push(t);
  for (const c of checkins.rows) byId.get(c.entry_id).checkins.push(c);
  for (const p of photos.rows) byId.get(p.entry_id).photos.push(await photoDto(p));
  return [...byId.values()];
}
