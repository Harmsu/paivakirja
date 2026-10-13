import { describe, it, expect, beforeEach } from 'vitest';
import { authed, reset, pool } from './helpers.js';

describe('Suosikit', () => {
  let a;
  beforeEach(async () => { await reset(); a = await authed(); });
  const fav = body => a.post('/api/favorites').send(body);

  it('POST, PUT, DELETE; olematon id antaa 404', async () => {
    const f = (await fav({ name: 'Kirjasto', category: 'kirjasto', latitude: 65.01, longitude: 25.47 })).body;
    expect(f).toMatchObject({ name: 'Kirjasto', use_count: 0, last_used_at: null });
    const u = await a.put(`/api/favorites/${f.id}`).send({ name: 'Pääkirjasto', category: null, latitude: null, longitude: null });
    expect(u.body).toMatchObject({ name: 'Pääkirjasto', category: null, latitude: null });
    expect((await a.put('/api/favorites/999999').send({ name: 'X' })).status).toBe(404);
    expect((await a.delete('/api/favorites/999999')).status).toBe(404);
    expect((await a.delete(`/api/favorites/${f.id}`)).status).toBe(204);
    expect((await a.get('/api/favorites')).body).toEqual([]);
  });

  it('nimi pakollinen ja koordinaatit validoidaan kuten checkineissä', async () => {
    expect((await fav({ name: ' ' })).body.error).toBe('Paikan nimi puuttuu');
    for (const c of [{ latitude: 'a', longitude: 'b' }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: 1 }]) {
      expect((await fav({ name: 'X', ...c })).status, JSON.stringify(c)).toBe(400);
    }
    const f = (await fav({ name: 'Y' })).body;
    expect((await a.put(`/api/favorites/${f.id}`).send({ name: '' })).status).toBe(400);
  });

  it('samanniminen suosikki ei luo tuplaa (myös eri kirjainkoolla): 409 ja olemassa olevan nimi', async () => {
    await fav({ name: 'Linnanmaan uimahalli' });
    const dup = await fav({ name: 'LINNANMAAN uimahalli' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('Linnanmaan uimahalli on jo suosikeissa');
    const other = (await fav({ name: 'Koti' })).body;
    expect((await a.put(`/api/favorites/${other.id}`).send({ name: 'linnanmaan uimahalli' })).status).toBe(409);
    expect((await a.get('/api/favorites')).body).toHaveLength(2);
  });

  it('järjestys: use_count laskevasti, sitten nimi; käyttö päivittää last_used_at', async () => {
    const b = (await fav({ name: 'Bensa-asema' })).body;
    const c = (await fav({ name: 'Citymarket' })).body;
    await fav({ name: 'Apteekki' });
    const use = (f, date) => a.post(`/api/entries/${date}/checkins`).send({ place_name: f.name, favorite_id: f.id });
    await use(c, '2026-01-02'); await use(c, '2026-01-03'); await use(b, '2026-01-04');
    const list = (await a.get('/api/favorites')).body;
    expect(list.map(f => [f.name, f.use_count])).toEqual([['Citymarket', 2], ['Bensa-asema', 1], ['Apteekki', 0]]);
    expect(list[0].last_used_at).not.toBeNull();
    expect(list[2].last_used_at).toBeNull();
    // Muokattu checkin suosikista kasvattaa myös
    const ci = (await a.get('/api/entries/2026-01-04')).body.checkins[0];
    await a.put(`/api/checkins/${ci.id}`).send({ place_name: 'Bensa-asema', favorite_id: b.id });
    expect((await a.get('/api/favorites')).body.find(f => f.id === b.id).use_count).toBe(2);
  });

  it('TÄRKEIN: checkin kopioi tiedot; suosikin muokkaus ja poisto eivät muuta checkiniä', async () => {
    const f = (await fav({ name: 'Uimahalli', category: 'uimahalli', latitude: 65.05, longitude: 25.47 })).body;
    await a.post('/api/entries/2026-02-02/checkins')
      .send({ place_name: f.name, category: f.category, latitude: f.latitude, longitude: f.longitude, favorite_id: f.id });
    await a.put(`/api/favorites/${f.id}`).send({ name: 'Uimahalli UUSI', category: 'urheilu', latitude: 61, longitude: 23 });
    let c = (await a.get('/api/entries/2026-02-02')).body.checkins[0];
    expect(c).toMatchObject({ place_name: 'Uimahalli', category: 'uimahalli', latitude: 65.05, longitude: 25.47 });
    await a.delete(`/api/favorites/${f.id}`);
    c = (await a.get('/api/entries/2026-02-02')).body.checkins[0];
    expect(c).toMatchObject({ place_name: 'Uimahalli', latitude: 65.05 });
  });

  it('checkins-taulussa ei ole viittausta favorite_places-tauluun', async () => {
    const { rows: cols } = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'checkins'"
    );
    expect(cols.map(c => c.column_name)).not.toContain('favorite_id');
    const { rows: fks } = await pool.query(`
      SELECT 1 FROM pg_constraint WHERE contype = 'f'
        AND conrelid = 'checkins'::regclass AND confrelid = 'favorite_places'::regclass`);
    expect(fks).toHaveLength(0);
  });
});
