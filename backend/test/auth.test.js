import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { api, reset, token } from './helpers.js';

const login = body => api().post('/api/auth/login').send(body);

describe('Kirjautuminen', () => {
  beforeAll(reset);

  it('oikeat tunnukset palauttavat tokenin, voimassa 30 pv', async () => {
    const res = await login({ username: process.env.TEST_USERNAME, password: process.env.TEST_PASSWORD });
    expect(res.status).toBe(200);
    const p = jwt.decode(res.body.token);
    expect(Math.round((p.exp - p.iat) / 86400)).toBe(30);
  });

  it('väärä salasana, väärä tunnus ja tyhjät kentät hylätään samalla viestillä', async () => {
    const cases = [
      { username: process.env.TEST_USERNAME, password: 'väärä' },
      { username: 'eiole', password: process.env.TEST_PASSWORD },
      { username: '', password: '' },
      {},
    ];
    const messages = new Set();
    for (const c of cases) {
      const res = await login(c);
      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
      messages.add(res.body.error);
    }
    expect([...messages]).toEqual(['Väärä tunnus tai salasana']);
  });
});

describe('Suojaus: data-reitit vaativat voimassa olevan tokenin', () => {
  const routes = [
    ['get', '/api/entries'], ['get', '/api/entries/2026-01-01'], ['delete', '/api/entries/2026-01-01'],
    ['get', '/api/entries/on-this-day?month=1&day=1'], ['put', '/api/entries/2026-01-01/order'],
    ['post', '/api/entries/2026-01-01/texts'], ['put', '/api/texts/1'], ['delete', '/api/texts/1'],
    ['post', '/api/entries/2026-01-01/photos'], ['put', '/api/photos/1'], ['delete', '/api/photos/1'],
    ['post', '/api/entries/2026-01-01/checkins'], ['put', '/api/checkins/1'], ['delete', '/api/checkins/1'],
    ['get', '/api/favorites'], ['post', '/api/favorites'], ['put', '/api/favorites/1'], ['delete', '/api/favorites/1'],
    ['get', '/api/summary/days?month=1'], ['get', '/api/summary/map'], ['get', '/api/geocode?q=Oulu'],
    ['get', '/api/export'],
  ];
  const secret = () => process.env.JWT_SECRET;
  const tokens = {
    'ilman tokenia': null,
    'väärä token': 'roskaa.roskaa.roskaa',
    'muokattu token': async () => {
      const [h, , s] = (await token()).split('.');
      const payload = Buffer.from(JSON.stringify({ sub: 'hyokkaaja', iat: 1, exp: 4102444800 })).toString('base64url');
      return `${h}.${payload}.${s}`;
    },
    'eri avaimella allekirjoitettu': () => jwt.sign({ sub: process.env.TEST_USERNAME }, 'toinen-avain'),
    'vanhentunut token': () => jwt.sign({ sub: process.env.TEST_USERNAME, exp: Math.floor(Date.now() / 1000) - 60 }, secret()),
  };

  for (const [label, make] of Object.entries(tokens)) {
    it(`${label} -> 401 kaikilla reiteillä`, async () => {
      const t = typeof make === 'function' ? await make() : make;
      for (const [method, path] of routes) {
        const req = api()[method](path);
        if (t) req.set('Authorization', `Bearer ${t}`);
        const res = await req;
        expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
      }
    });
  }
});
