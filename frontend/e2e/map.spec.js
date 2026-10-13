import { test, expect, TODAY } from './fixtures.js';

const markers = page => page.locator('path.leaflet-interactive');

test.describe('Kartta', () => {
  test('tyhjä tila ilman virhettä', async ({ authedPage: page }) => {
    await page.goto('/#/map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.getByText('0 käyntiä')).toBeVisible();
    await expect(markers(page)).toHaveCount(0);
    await expect(page.locator('.map-empty')).toContainText('Kartalla näkyvät paikat, joilla on sijainti');
  });

  test('merkit koordinaatillisille, ponnahdusikkuna ja linkki, paikka ilman koordinaatteja ei kaada', async ({ authedPage: page, api }) => {
    await api.seed(); // 4 koordinaatillista paikkaa + Mökki ilman koordinaatteja
    await page.goto('/#/map');
    await expect(page.getByText('4 käyntiä')).toBeVisible();
    await expect(markers(page)).toHaveCount(4);
    // Napautetaan merkkiä, jonka ponnahdusikkunassa on Kahvila Kaarna
    for (let i = 0; i < 4; i++) {
      await markers(page).nth(i).click({ force: true });
      if (await page.locator('.leaflet-popup-content').textContent().then(t => t.includes('Kahvila Kaarna'))) break;
    }
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toContainText('Kahvila Kaarna');
    await expect(popup).toContainText('kahvila');
    await popup.getByRole('link', { name: '13.10.2026' }).click();
    await expect(page).toHaveURL(new RegExp(`#/day/${TODAY}$`));
  });

  test('ajanjaksosuodatus ja sen poisto', async ({ authedPage: page, api }) => {
    await api.seed();
    await page.goto('/#/map');
    await expect(markers(page)).toHaveCount(4);
    await page.locator('.filters select').selectOption('30');
    await expect(page.getByText('2 käyntiä')).toBeVisible();
    await expect(markers(page)).toHaveCount(2);
    await page.locator('.filters select').selectOption('custom');
    const [from, to] = [page.locator('.filters input[type=date]').first(), page.locator('.filters input[type=date]').last()];
    await from.fill('2025-01-01');
    await to.fill('2025-12-31');
    await expect(page.getByText('2 käyntiä')).toBeVisible(); // Kiasma + uudenvuoden juhla
    await to.fill('2024-01-01'); // alku loppua myöhemmin
    await expect(page.getByText('0 käyntiä')).toBeVisible();
    await expect(page.locator('.map-empty')).toContainText('Ei paikkoja valitulla aikavälillä');
    await page.locator('.filters select').selectOption('all');
    await expect(page.locator('.map-empty')).toHaveCount(0);
    await expect(markers(page)).toHaveCount(4);
  });

  test('suosikista tehty checkin näkyy kartalla, vaikka suosikki poistetaan', async ({ authedPage: page, api }) => {
    const f = await api.post('/api/favorites', { name: 'Tuomiokirkko', latitude: 60.1704, longitude: 24.9522 });
    await api.post(`/api/entries/${TODAY}/checkins`, { place_name: f.name, latitude: f.latitude, longitude: f.longitude, favorite_id: f.id });
    await api.delete(`/api/favorites/${f.id}`);
    await page.goto('/#/map');
    await expect(markers(page)).toHaveCount(1);
    await markers(page).first().click({ force: true });
    await expect(page.locator('.leaflet-popup-content')).toContainText('Tuomiokirkko');
  });
});
