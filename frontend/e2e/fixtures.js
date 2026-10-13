// Yhteiset apurit selaintesteille:
// - data nollataan ennen jokaista testiä
// - selaimen kello kiinnitetään päivään TODAY (Suomen aikaa), testidata samalle päivälle
// - käsittelemättömät virheet ja selaimen dialogit (alert) kaatavat testin
import { test as base, expect } from '@playwright/test';
import { loadTestEnv } from '../../backend/test/env.js';
import { resetData } from '../../backend/test/test-db.js';
import { seed as seedData, jpeg, png } from '../../backend/test/seed.js';

export { expect, jpeg, png };
export const TODAY = '2026-10-13';
export const API = 'http://localhost:3101';
const env = loadTestEnv();
const TOKEN_KEY = 'paikka-ja-kuvapaivakirja_token';

// Yksi kirjautuminen koko ajolle: backend rajoittaa kirjautumisyrityksiä (20 / 15 min)
let cachedToken = null;
async function apiToken(request) {
  if (cachedToken) return cachedToken;
  const r = await request.post(`${API}/api/auth/login`, {
    data: { username: env.TEST_USERNAME, password: env.TEST_PASSWORD },
  });
  if (!r.ok()) throw new Error(`Testikirjautuminen epäonnistui: ${r.status()} ${await r.text()}`);
  cachedToken = (await r.json()).token;
  return cachedToken;
}

export const test = base.extend({
  credentials: [{ username: env.TEST_USERNAME, password: env.TEST_PASSWORD }, { option: true }],

  page: async ({ page }, use) => {
    await resetData(env.DATABASE_URL, env.LOCAL_STORAGE_DIR);
    await page.clock.install({ time: new Date(`${TODAY}T12:00:00+03:00`) });
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      // Odotetut verkkovirheet (esim. testin katkaisema yhteys, kartan laatat) eivät ole sovelluksen virheitä
      if (/Failed to load resource|net::ERR_|ERR_FAILED/.test(t)) return;
      errors.push(`console: ${t}`);
    });
    page.on('dialog', d => { errors.push(`dialog: ${d.message()}`); d.dismiss(); });
    // Kartan laatat ulkoisesta palvelusta: ei verkkoliikennettä testeissä
    await page.route('https://tile.openstreetmap.org/**', r => r.abort());
    await use(page);
    expect(errors, 'selaimessa ei saa olla käsittelemättömiä virheitä').toEqual([]);
  },

  // API-asiakas testidatan luontiin (sama sovitin kuin API-testeissä)
  api: async ({ request }, use) => {
    const token = await apiToken(request);
    const headers = { Authorization: `Bearer ${token}` };
    const check = async (r, path) => {
      if (!r.ok()) throw new Error(`${path}: ${r.status()} ${await r.text()}`);
      return r.status() === 204 ? null : r.json();
    };
    await use({
      token,
      get: async path => check(await request.get(API + path, { headers }), path),
      post: async (path, data) => check(await request.post(API + path, { headers, data }), path),
      delete: async path => check(await request.delete(API + path, { headers }), path),
      upload: async (path, f) => check(await request.post(API + path, { headers, multipart: { file: f } }), path),
      seed: async function () { return seedData(this, TODAY); },
    });
  },

  // Sivu valmiiksi kirjautuneena (token localStorageen)
  authedPage: async ({ page, api }, use) => {
    await page.goto('/');
    await page.evaluate(([k, t]) => localStorage.setItem(k, t), [TOKEN_KEY, api.token]);
    // App lukee tokenin käynnistyessä. Asetuksiin, jotta testin ensimmäinen goto vaihtaa näkymän
    // (saman hash-osoitteen goto ei lataa näkymää uudelleen).
    await page.goto('/#/settings');
    await page.reload();
    await use(page);
  },
});

export async function loginViaUi(page, { username, password }) {
  await page.getByPlaceholder('Käyttäjätunnus').fill(username);
  await page.getByPlaceholder('Salasana').fill(password);
  await page.getByRole('button', { name: 'Kirjaudu' }).click();
}

// Ei vaakasuuntaista vieritystä (mobiili)
export async function expectNoHorizontalScroll(page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  }));
  expect(sw, 'sivu ei saa levitä vaakasuunnassa').toBeLessThanOrEqual(cw);
}
