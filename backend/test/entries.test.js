import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { authed, reset, pool, countRows } from './helpers.js';
import { jpeg } from './seed.js';

const D = '2026-05-20';

describe('Entryt ja tekstilohkot', () => {
  let a;
  beforeEach(async () => { await reset(); a = await authed(); });

  it('yksi entry per päivä: toinen lisäys samalle päivälle täydentää, ei tee tuplaa', async () => {
    const t1 = await a.post(`/api/entries/${D}/texts`).send({ content: 'Eka' });
    const t2 = await a.post(`/api/entries/${D}/texts`).send({ content: 'Toka' });
    expect(t1.status).toBe(201);
    expect(t2.body.entry_id).toBe(t1.body.entry_id);
    expect(await countRows('entries')).toBe(1);
  });

  it('tietokannassa on yksilöllisyysrajoite entries.date', async () => {
    const { rows } = await pool.query(`
      SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'entries'::regclass AND i.indisunique AND a.attname = 'date'`);
    expect(rows.length).toBeGreaterThan(0);
    await pool.query("INSERT INTO entries (date) VALUES ('2026-01-01')");
    await expect(pool.query("INSERT INTO entries (date) VALUES ('2026-01-01')")).rejects.toThrow(/unique|yksil/i);
  });

  it('tyhjä päivä palauttaa tyhjän rungon, virheellinen päivä hylätään', async () => {
    const r = await a.get('/api/entries/2026-03-03');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: null, date: '2026-03-03', text_blocks: [], photos: [], checkins: [] });
    for (const bad of ['2026-02-30', '2026-13-01', 'eilen', '2026-1-1']) {
      expect((await a.get(`/api/entries/${bad}`)).status, bad).toBe(400);
    }
  });

  it('useita tekstilohkoja, järjestys säilyy ja vaihtuu', async () => {
    const ids = [];
    for (const c of ['A', 'B', 'C']) ids.push((await a.post(`/api/entries/${D}/texts`).send({ content: c })).body.id);
    let day = (await a.get(`/api/entries/${D}`)).body;
    expect(day.text_blocks.map(t => t.content)).toEqual(['A', 'B', 'C']);
    expect((await a.put(`/api/entries/${D}/order`).send({ text_blocks: [ids[2], ids[0], ids[1]] })).status).toBe(204);
    day = (await a.get(`/api/entries/${D}`)).body;
    expect(day.text_blocks.map(t => t.content)).toEqual(['C', 'A', 'B']);
  });

  it('tyhjä tai pelkkiä välilyöntejä sisältävä lohko hylätään', async () => {
    for (const content of ['', '   \n  ', undefined]) {
      const r = await a.post(`/api/entries/${D}/texts`).send({ content });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Teksti puuttuu');
    }
    expect(await countRows('entries')).toBe(0);
  });

  it('pitkä teksti, rivinvaihdot, ääkköset, emojit ja erikoismerkit säilyvät', async () => {
    const content = ('Äiti öljysi åänen 😀🏊‍♀️ "lainaus" \'heittomerkki\' <b>&amp; \\ % _ \t tabi\n').repeat(120).trim();
    expect(content.length).toBeGreaterThan(5000);
    const r = await a.post(`/api/entries/${D}/texts`).send({ content });
    expect(r.status).toBe(201);
    expect((await a.get(`/api/entries/${D}`)).body.text_blocks[0].content).toBe(content);
  });

  it('lohkon muokkaus ja poisto; viimeisen poisto poistaa tyhjän entryn', async () => {
    const t = (await a.post(`/api/entries/${D}/texts`).send({ content: 'Alku' })).body;
    const u = await a.put(`/api/texts/${t.id}`).send({ content: 'Muokattu' });
    expect(u.body.content).toBe('Muokattu');
    expect((await a.put(`/api/texts/${t.id}`).send({ content: ' ' })).status).toBe(400);
    expect((await a.delete(`/api/texts/${t.id}`)).status).toBe(204);
    expect((await a.delete(`/api/texts/${t.id}`)).status).toBe(404);
    expect(await countRows('entries')).toBe(0);
  });

  it('entryn poisto poistaa tekstit, kuvat (myös tiedostot) ja paikat, orpoja ei jää', async () => {
    await a.post(`/api/entries/${D}/texts`).send({ content: 'x' });
    await a.post(`/api/entries/${D}/checkins`).send({ place_name: 'Paikka' });
    const p = (await a.post(`/api/entries/${D}/photos`).attach('file', await jpeg(), 'a.jpg')).body;
    const file = path.join(process.env.LOCAL_STORAGE_DIR, p.url.replace('/dev-storage/', ''));
    expect(fs.existsSync(file)).toBe(true);

    expect((await a.delete(`/api/entries/${D}`)).status).toBe(204);
    for (const t of ['entries', 'text_blocks', 'photos', 'checkins']) expect(await countRows(t), t).toBe(0);
    expect(fs.existsSync(file)).toBe(false);
    expect((await a.delete(`/api/entries/${D}`)).status).toBe(404);
  });
});
