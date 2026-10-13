import { test, expect } from './fixtures.js';

const stats = async page => {
  const s = page.locator('.stats > div');
  await expect(s).toHaveCount(4);
  return Object.fromEntries(await s.evaluateAll(divs => divs.map(d => [d.querySelector('span').textContent, Number(d.querySelector('strong').textContent)])));
};

test.describe('Koonnit', () => {
  test('kuukausi-koonti näyttää testidatan oikein', async ({ authedPage: page, api }) => {
    await api.seed();
    await page.goto('/#/month/2026-10');
    await expect(page.getByRole('heading', { name: 'lokakuu 2026' })).toBeVisible();
    expect(await stats(page)).toEqual({ päivää: 3, kuvaa: 4, käyntiä: 2, paikkaa: 2 });
    await expect(page.locator('.cal-day.has')).toHaveCount(3);
    await expect(page.locator('.cal-day.today')).toHaveText(/13/);
    await expect(page.locator('.month-list li')).toHaveCount(3);
    await expect(page.locator('.month-list li').first()).toContainText('Linnanmaan uimahalli, Kahvila Kaarna');
  });

  test('vuosi-koonti näyttää testidatan oikein, vuoden vaihde oikeaan vuoteen', async ({ authedPage: page, api }) => {
    await api.seed();
    await page.goto('/#/year/2026');
    expect(await stats(page)).toEqual({ päivää: 5, kuvaa: 4, käyntiä: 3, paikkaa: 3 });
    await expect(page.locator('.month-card').filter({ hasText: 'tammikuu' })).toContainText('1 pv');
    await expect(page.locator('.month-card').filter({ hasText: 'joulukuu' })).not.toContainText('pv');
    await page.goto('/#/year/2025');
    await expect(page.locator('.month-card').filter({ hasText: 'joulukuu' })).toContainText('1 pv');
  });

  test('tyhjät tilat: kuukausi ja vuosi ilman dataa', async ({ authedPage: page }) => {
    await page.goto('/#/month/2026-03');
    expect(await stats(page)).toEqual({ päivää: 0, kuvaa: 0, käyntiä: 0, paikkaa: 0 });
    await expect(page.locator('.month-list')).toHaveCount(0);
    await expect(page.getByText('Ei kirjauksia tässä kuussa.')).toBeVisible();
    await page.goto('/#/year/2019');
    expect(await stats(page)).toEqual({ päivää: 0, kuvaa: 0, käyntiä: 0, paikkaa: 0 });
    await expect(page.locator('.month-card.empty')).toHaveCount(12);
    await expect(page.getByText('Ei kirjauksia vuonna 2019.')).toBeVisible();
  });

  test('navigointi vuodesta kuukauteen ja päivään sekä selaimen Takaisin', async ({ authedPage: page, api }) => {
    await api.seed();
    await page.goto('/#/year/2026');
    await page.locator('.month-card').filter({ hasText: 'lokakuu' }).click();
    await expect(page).toHaveURL(/#\/month\/2026-10$/);
    await page.locator('.cal-day.today').click();
    await expect(page).toHaveURL(/#\/day\/2026-10-13$/);
    await expect(page.locator('.text-block').first()).toHaveText('Aamulla kävin uimassa.');
    await page.goBack();
    await expect(page).toHaveURL(/#\/month\/2026-10$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/year\/2026$/);
    // Kuukaudesta vuoteen otsikon linkistä
    await page.goto('/#/month/2026-10');
    await page.getByRole('link', { name: 'lokakuu 2026' }).click();
    await expect(page).toHaveURL(/#\/year\/2026$/);
  });

  test('uusi kirjaus päivittää koonnin', async ({ authedPage: page, api }) => {
    await api.seed();
    await page.goto('/#/month/2026-10');
    expect((await stats(page)).päivää).toBe(3);
    await page.getByRole('link', { name: '20', exact: true }).click();
    await page.getByPlaceholder('Mitä tänään tapahtui?').fill('Uusi päivä');
    await page.getByRole('button', { name: 'Lisää teksti' }).click();
    await expect(page.locator('.text-block')).toHaveText('Uusi päivä');
    await page.goto('/#/month/2026-10');
    await expect(page.locator('.stats > div').first()).toContainText('4');
  });
});

test.describe('Tänä päivänä', () => {
  test('aiempien vuosien kirjaukset rinnakkain', async ({ authedPage: page, api }) => {
    await api.seed();
    await page.goto('/#/otd');
    await expect(page.getByRole('heading', { name: '13. lokakuuta' })).toBeVisible();
    await expect(page.locator('.side-by-side article.entry .entry-date')).toHaveText([/2026/, /2025/, /2024/]);
    await page.getByRole('button', { name: 'Sama kuukausi' }).click();
    await expect(page.locator('.side-by-side section h2')).toHaveText(['2026', '2025', '2024']);
  });

  test('ei dataa: ohjeteksti; 29.2. ja päivä ilman kirjauksia eivät kaada', async ({ authedPage: page }) => {
    await page.goto('/#/otd');
    await expect(page.getByText('Ei kirjauksia tältä ajalta aiempina vuosina.')).toBeVisible();
    await page.goto('/#/otd/02-29');
    await expect(page.getByRole('heading', { name: '29. helmikuuta' })).toBeVisible();
    await expect(page.getByText('Ei kirjauksia tältä ajalta aiempina vuosina.')).toBeVisible();
    await page.getByRole('button', { name: 'Seuraava' }).click();
    await expect(page.getByRole('heading', { name: '1. maaliskuuta' })).toBeVisible();
  });
});
