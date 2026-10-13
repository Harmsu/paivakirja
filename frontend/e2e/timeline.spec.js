import { test, expect, TODAY } from './fixtures.js';

test.describe('Päivä-näkymä (aikajana)', () => {
  test('tyhjän tilan ohjeteksti', async ({ authedPage: page }) => {
    await page.goto('/#/');
    await expect(page.getByText('Ei vielä kirjauksia.')).toBeVisible();
    await expect(page.getByText('Aloita painamalla +-nappia.')).toBeVisible();
  });

  test('päivät uusimmasta vanhimpaan, yhdistetty kortti ja yksittäiset tyypit, suomalainen päivämäärä', async ({ authedPage: page, api }) => {
    const d = await api.seed();
    await page.goto('/#/');
    const cards = page.locator('article.entry');
    await expect(cards).toHaveCount(8);
    const hrefs = await cards.locator('a.entry-date').evaluateAll(as => as.map(a => a.getAttribute('href')));
    const dates = hrefs.map(h => h.replace('#/day/', ''));
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates[0]).toBe(TODAY);

    const today = cards.first();
    await expect(today.locator('.entry-date')).toContainText('tiistai 13.10.2026');
    await expect(today.locator('.text-block')).toHaveText(['Aamulla kävin uimassa.', 'Illalla luin kirjaa.']);
    await expect(today.locator('.thumb img')).toHaveCount(3);
    await expect(today.locator('.checkin')).toHaveCount(2);
    await expect(today).toContainText('Linnanmaan uimahalli');

    const yesterday = cards.nth(1);
    await expect(yesterday.locator('.entry-date')).toContainText('12.10.2026');
    await expect(yesterday.locator('.thumb, .checkin')).toHaveCount(0);
    await expect(yesterday.locator('.text-block')).toHaveText('Eilen satoi koko päivän.');

    const weekAgo = page.locator(`article.entry:has(a[href="#/day/${d.weekAgo}"])`);
    await expect(weekAgo.locator('.thumb img')).toHaveCount(1);
    await expect(weekAgo.locator('.text-block, .checkin')).toHaveCount(0);
    const monthAgo = page.locator(`article.entry:has(a[href="#/day/${d.monthAgo}"])`);
    await expect(monthAgo.locator('.checkin')).toHaveText(/Mökki/);
  });

  test('aikajana ei näytä samaa päivää kahdesti (hidas vastaus + näkyvä sivun loppu)', async ({ authedPage: page, api }) => {
    await api.post('/api/entries/2026-10-13/texts', { content: 'Vain yksi kortti' });
    // Hidas vastaus: ensimmäinen haku ja sivun lopun tarkkailija ehtivät molemmat käynnistyä
    await page.route(/\/api\/entries\?/, async route => { await new Promise(r => setTimeout(r, 300)); await route.continue(); });
    for (let i = 0; i < 5; i++) {
      await page.goto('/#/settings');
      await page.goto('/#/');
      await expect(page.locator('article.entry')).toHaveCount(1);
      await page.waitForTimeout(600);
      await expect(page.locator('article.entry')).toHaveCount(1);
    }
  });
});
