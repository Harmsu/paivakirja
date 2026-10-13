import { describe, it, expect, beforeEach } from 'vitest';
import { api, authed, reset, pool, countRows } from './helpers.js';
import { runMigrations } from '../src/migrate.js';

const D = '2026-08-08';
const INJECTION = "'; DROP TABLE entries; --";
const XSS = '<script>alert(1)</script><img src=x onerror=alert(2)>';

describe('Virhetilanteet ja tietoturva', () => {
  let a;
  beforeEach(async () => { await reset(); a = await authed(); });

  it('SQL-injektio tallentuu tavallisena tekstinä tekstiin, paikkaan ja suosikkiin; taulut säilyvät', async () => {
    await a.post(`/api/entries/${D}/texts`).send({ content: INJECTION });
    await a.post(`/api/entries/${D}/checkins`).send({ place_name: INJECTION, category: INJECTION });
    expect((await a.post('/api/favorites').send({ name: INJECTION })).status).toBe(201);
    const day = (await a.get(`/api/entries/${D}`)).body;
    expect(day.text_blocks[0].content).toBe(INJECTION);
    expect(day.checkins[0].place_name).toBe(INJECTION);
    expect((await a.get('/api/favorites')).body[0].name).toBe(INJECTION);
    expect(await countRows('entries')).toBe(1);
    // Injektio myös kyselyparametreissa ja polussa
    expect((await a.get(`/api/entries?before=${encodeURIComponent(INJECTION)}`)).status).toBe(400);
    expect((await a.get(`/api/summary/map?from=${encodeURIComponent(INJECTION)}`)).status).toBe(400);
    expect((await a.get(`/api/entries/on-this-day?month=${encodeURIComponent('1 OR 1=1')}&day=1`)).status).toBe(200);
    expect(await countRows('entries')).toBe(1);
  });

  it('HTML ja skripti tallentuvat sellaisenaan tekstinä (frontend escapoi, ks. selaintestit)', async () => {
    await a.post(`/api/entries/${D}/texts`).send({ content: XSS });
    await a.post(`/api/entries/${D}/checkins`).send({ place_name: XSS, latitude: 60, longitude: 25 });
    const day = (await a.get(`/api/entries/${D}`)).body;
    expect(day.text_blocks[0].content).toBe(XSS);
    expect(day.checkins[0].place_name).toBe(XSS);
  });

  it('paikan ja suosikin nimi enintään 200 merkkiä (emojit lasketaan merkkeinä)', async () => {
    const max = 'a'.repeat(199) + '😀';
    const r = await a.post(`/api/entries/${D}/checkins`).send({ place_name: max });
    expect(r.status).toBe(201);
    expect(r.body.place_name).toBe(max);
    for (const [path, body] of [[`/api/entries/${D}/checkins`, { place_name: 'b'.repeat(201) }], ['/api/favorites', { name: 'c'.repeat(201) }]]) {
      const t = await a.post(path).send(body);
      expect(t.status, path).toBe(400);
      expect(t.body.error).toBe('Paikan nimi on liian pitkä (enintään 200 merkkiä)');
    }
    const c = r.body;
    expect((await a.put(`/api/checkins/${c.id}`).send({ place_name: 'd'.repeat(201) })).status).toBe(400);
    expect((await a.post('/api/favorites').send({ name: max })).status).toBe(201);
  });

  it('päivä kaukana menneisyydessä ja tulevaisuudessa', async () => {
    for (const date of ['1900-01-01', '0999-12-31', '2999-12-31']) {
      const r = await a.post(`/api/entries/${date}/texts`).send({ content: date });
      expect(r.status, date).toBe(201);
      expect((await a.get(`/api/entries/${date}`)).body.date).toBe(date);
    }
  });

  it('aikavyöhyke: päivämäärä ei siirry palvelimen aikavyöhykkeen mukana', async () => {
    const original = process.env.TZ;
    try {
      for (const tz of ['Pacific/Kiritimati', 'Europe/Helsinki', 'America/Los_Angeles', 'UTC']) {
        process.env.TZ = tz;
        const date = '2026-10-13';
        await a.post(`/api/entries/${date}/texts`).send({ content: tz });
        expect((await a.get(`/api/entries/${date}`)).body.date, tz).toBe(date);
        expect((await a.get('/api/entries?limit=1')).body[0].date, tz).toBe(date);
      }
    } finally {
      if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
    }
  });

  it('migraatiot toisen kerran samaan kantaan: ei virheitä, data säilyy', async () => {
    await a.post(`/api/entries/${D}/texts`).send({ content: 'säilyy' });
    expect(await runMigrations(pool, () => {})).toEqual([]);
    expect((await a.get(`/api/entries/${D}`)).body.text_blocks[0].content).toBe('säilyy');
  });

  it('rikkinäinen JSON antaa 400, ei palvelinvirhettä', async () => {
    const r = await a.post(`/api/entries/${D}/texts`).set('Content-Type', 'application/json').send('{"content": ');
    expect(r.status).toBe(400);
    expect(r.body.error).toBeTruthy();
  });

  it('liian suuri JSON-pyyntö antaa 413 suomenkielisellä virheellä', async () => {
    const r = await a.post(`/api/entries/${D}/texts`).send({ content: 'x'.repeat(1.2 * 1024 * 1024) });
    expect(r.status).toBe(413);
    expect(r.body.error).toMatch(/liian suuri/i);
  });

  it('virheellinen id antaa 404, ei palvelinvirhettä', async () => {
    for (const path of ['/api/texts/abc', '/api/photos/1.5', '/api/checkins/99999999999', '/api/favorites/x']) {
      const r = await a.put(path).send({ content: 'x', caption: 'x', place_name: 'x', name: 'x' });
      expect(r.status, `PUT ${path}`).toBe(404);
      expect((await a.delete(path)).status, `DELETE ${path}`).toBe(404);
    }
  });

  it('järjestyksen vaihto virheellisillä id:illä antaa 400', async () => {
    await a.post(`/api/entries/${D}/texts`).send({ content: 'x' });
    for (const ids of [['abc'], [1.5], [null], ['1; DROP TABLE entries']]) {
      const r = await a.put(`/api/entries/${D}/order`).send({ text_blocks: ids });
      expect(r.status, JSON.stringify(ids)).toBe(400);
    }
  });

  it('virhevastaukset eivät vuoda salasanoja, SQL:ää tai pinojälkiä', async () => {
    const responses = [
      await api().post('/api/auth/login').send({ username: 'x', password: 'y' }),
      await a.post(`/api/entries/${D}/texts`).set('Content-Type', 'application/json').send('{rikki'),
      await a.put('/api/texts/abc').send({ content: 'x' }),
      await a.post(`/api/entries/${D}/checkins`).send({ place_name: 'x', latitude: 'a', longitude: 'b' }),
      await a.post(`/api/entries/${D}/photos`).attach('file', Buffer.from('x'), { filename: 'x.jpg', contentType: 'image/jpeg' }),
    ];
    for (const r of responses) {
      const text = JSON.stringify(r.body) + (r.text || '');
      expect(text).not.toMatch(/SELECT|INSERT|UPDATE |DELETE FROM|syntax|at .*\.js|node_modules|\$2[aby]\$|password|stack/i);
    }
  });
});
