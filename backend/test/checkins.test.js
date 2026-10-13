import { describe, it, expect, beforeEach } from 'vitest';
import { authed, reset } from './helpers.js';

const D = '2026-07-01';

describe('Paikat (checkinit)', () => {
  let a;
  beforeEach(async () => { await reset(); a = await authed(); });
  const add = body => a.post(`/api/entries/${D}/checkins`).send(body);

  it('pelkkä nimi riittää; nimi + kategoria + koordinaatit tallentuvat', async () => {
    const r1 = await add({ place_name: 'Koti' });
    expect(r1.status).toBe(201);
    expect(r1.body).toMatchObject({ place_name: 'Koti', category: null, latitude: null, longitude: null });
    const r2 = await add({ place_name: 'Kiasma', category: 'museo', latitude: 60.1717, longitude: 24.9364 });
    expect(r2.body).toMatchObject({ category: 'museo', latitude: 60.1717, longitude: 24.9364 });
  });

  it('ilman nimeä hylätään', async () => {
    for (const body of [{}, { place_name: '' }, { place_name: '   ', latitude: 60, longitude: 25 }]) {
      const r = await add(body);
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Paikan nimi puuttuu');
    }
  });

  it('virheelliset koordinaatit hylätään suomenkielisellä virheellä', async () => {
    const cases = [
      { latitude: 'abc', longitude: 'def' }, { latitude: 91, longitude: 25 }, { latitude: -90.5, longitude: 25 },
      { latitude: 60, longitude: 181 }, { latitude: 60, longitude: -180.1 },
      { latitude: 60 }, { longitude: 25 }, { latitude: 60, longitude: 'x' },
    ];
    for (const c of cases) {
      const r = await add({ place_name: 'X', ...c });
      expect(r.status, JSON.stringify(c)).toBe(400);
      expect(r.body.error).toMatch(/koordinaat|leveys/i);
    }
    expect((await a.get(`/api/entries/${D}`)).body.checkins).toHaveLength(0);
  });

  it('useita paikkoja samalle päivälle, sama paikka kahdesti, ääkköset ja erikoismerkit', async () => {
    const names = ['Café Ääkkönen & Öljy "Ö"', 'Café Ääkkönen & Öljy "Ö"', "O'Learyn <pubi> 🍺"];
    for (const n of names) expect((await add({ place_name: n })).status).toBe(201);
    const day = (await a.get(`/api/entries/${D}`)).body;
    expect(day.checkins.map(c => c.place_name)).toEqual(names);
  });

  it('muokkaus ja poisto', async () => {
    const c = (await add({ place_name: 'Vanha', latitude: 60, longitude: 25 })).body;
    const u = await a.put(`/api/checkins/${c.id}`).send({ place_name: 'Uusi', category: 'puisto', latitude: null, longitude: null });
    expect(u.body).toMatchObject({ place_name: 'Uusi', category: 'puisto', latitude: null });
    expect((await a.put(`/api/checkins/${c.id}`).send({ place_name: '' })).status).toBe(400);
    expect((await a.delete(`/api/checkins/${c.id}`)).status).toBe(204);
    expect((await a.put(`/api/checkins/${c.id}`).send({ place_name: 'X' })).status).toBe(404);
  });
});
