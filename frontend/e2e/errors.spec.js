import { test, expect, loginViaUi, API } from './fixtures.js';

const ENGLISH = /\b(Error|Loading|Submit|Cancel|Save|Delete|Login|Logout|undefined|null|NaN|Internal Server Error|Failed to fetch|TypeError)\b/;

test.describe('Virhetilanteet', () => {
  test('backend alhaalla: kirjautuminen näyttää suomenkielisen virheen', async ({ page, credentials }) => {
    await page.route(`${API}/**`, r => r.abort('connectionrefused'));
    await page.goto('/');
    await loginViaUi(page, credentials);
    const err = page.locator('.error');
    await expect(err).toBeVisible();
    await expect(err).not.toHaveText(ENGLISH);
    await expect(err).toContainText('Palvelimeen ei saada yhteyttä');
  });

  test('backend alhaalla kirjautuneena: näkymät näyttävät suomenkielisen virheen, ei valkoista sivua', async ({ authedPage: page }) => {
    await page.route(`${API}/**`, r => r.abort('connectionrefused'));
    for (const path of ['/#/', `/#/day/2026-10-13`, '/#/month/2026-10', '/#/year/2026', '/#/otd', '/#/map', '/#/favorites']) {
      await page.goto(path);
      const err = page.locator('.error').first();
      await expect(err, path).toBeVisible();
      await expect(err, path).toContainText('Palvelimeen ei saada yhteyttä');
      await expect(page.locator('.bottomnav'), path).toBeVisible();
    }
  });

  test('palvelinvirhe (500) näytetään siistinä suomenkielisenä viestinä', async ({ authedPage: page }) => {
    await page.route(/\/api\/entries\?/, r => r.fulfill({ status: 500, contentType: 'text/html', body: '<h1>Internal Server Error</h1>' }));
    await page.goto('/#/');
    const err = page.locator('.error');
    await expect(err).toBeVisible();
    await expect(err).not.toHaveText(ENGLISH);
  });

  test('UI-teksteissä ei englanninkielisiä jäänteitä eikä raakoja virheitä', async ({ authedPage: page, api }) => {
    await api.seed();
    for (const path of ['/#/', '/#/day/2026-10-13', '/#/day/2020-01-01', '/#/month/2026-10', '/#/year/2026',
      '/#/otd', '/#/otd/10', '/#/map', '/#/favorites', '/#/settings']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Ladataan…')).toHaveCount(0);
      const text = await page.locator('body').innerText();
      expect(text, path).not.toMatch(ENGLISH);
    }
  });
});

test.describe('Aikavyöhyke', () => {
  for (const [time, expected] of [['2026-10-13T23:50:00+03:00', '2026-10-13'], ['2026-10-14T00:10:00+03:00', '2026-10-14']]) {
    test(`kirjaus klo ${time.slice(11, 16)} Suomen aikaa menee päivälle ${expected}`, async ({ authedPage: page, api }) => {
      await page.clock.setSystemTime(new Date(time));
      await page.goto('/#/');
      await page.getByRole('button', { name: 'Kirjaa tänään' }).click();
      await expect(page).toHaveURL(new RegExp(`#/day/${expected}$`));
      await page.getByPlaceholder('Mitä tänään tapahtui?').fill(`Kello ${time.slice(11, 16)}`);
      await page.getByRole('button', { name: 'Lisää teksti' }).click();
      await expect(page.locator('.text-block')).toBeVisible();
      expect((await api.get(`/api/entries/${expected}`)).text_blocks).toHaveLength(1);
    });
  }
});
