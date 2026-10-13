import { test, expect, TODAY, jpeg, png, expectNoHorizontalScroll } from './fixtures.js';

const files = async n => Promise.all(Array.from({ length: n }, async (_, i) => ({
  name: `kuva${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: await jpeg(800, 600, ['#e8730c', '#2f7d4f', '#335599'][i % 3]),
})));

test.describe('Kirjaaminen', () => {
  test('uusi kirjaus: oletuspäivä tänään, teksti + kuva + paikka samalle päivälle yhteen korttiin', async ({ authedPage: page }) => {
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Kirjaa tänään' }).click();
    await expect(page).toHaveURL(new RegExp(`#/day/${TODAY}$`));
    await expect(page.locator('.day-title')).toContainText('13.10.2026');

    await page.getByPlaceholder('Mitä tänään tapahtui?').fill('Ensimmäinen kirjaus');
    await page.getByRole('button', { name: 'Lisää teksti' }).click();
    await expect(page.locator('.text-block')).toHaveText('Ensimmäinen kirjaus');

    await page.locator('input[type=file]').setInputFiles(await files(1));
    await expect(page.locator('.photo-item img')).toHaveCount(1);

    await page.getByRole('button', { name: '+ Lisää paikka' }).click();
    await page.getByPlaceholder('Paikan nimi').fill('Kauppatori');
    await page.getByRole('button', { name: 'Tallenna paikka' }).click();
    await expect(page.locator('.subcard').filter({ hasText: 'Kauppatori' })).toBeVisible();

    await page.goto('/#/');
    const card = page.locator('article.entry');
    await expect(card).toHaveCount(1);
    await expect(card.locator('.text-block')).toHaveText('Ensimmäinen kirjaus');
    await expect(card.locator('.thumb img')).toHaveCount(1);
    await expect(card.locator('.checkin')).toContainText('Kauppatori');
  });

  test('vanhan päivän täydennys säilyttää aiemman sisällön', async ({ authedPage: page, api }) => {
    const d = await api.seed();
    await page.goto(`/#/day/${d.weekAgo}`);
    await expect(page.locator('.photo-item img')).toHaveCount(1);
    await page.getByPlaceholder('Mitä tänään tapahtui?').fill('Lisätty jälkikäteen');
    await page.getByRole('button', { name: 'Lisää teksti' }).click();
    await expect(page.locator('.text-block')).toHaveText('Lisätty jälkikäteen');
    const day = await api.get(`/api/entries/${d.weekAgo}`);
    expect(day.photos).toHaveLength(1);
    expect(day.text_blocks).toHaveLength(1);
  });

  test('tekstilohkon muokkaus ja poisto vahvistuksella (peruutus säilyttää)', async ({ authedPage: page, api }) => {
    await api.post(`/api/entries/${TODAY}/texts`, { content: 'Alkuperäinen' });
    await page.goto(`/#/day/${TODAY}`);
    const block = page.locator('.subcard').filter({ hasText: 'Alkuperäinen' });
    await block.getByRole('button', { name: 'Muokkaa' }).click();
    await page.locator('textarea').first().fill('Muokattu teksti');
    await page.getByRole('button', { name: 'Tallenna', exact: true }).click();
    await expect(page.locator('.text-block')).toHaveText('Muokattu teksti');

    const edited = page.locator('.subcard').filter({ hasText: 'Muokattu teksti' });
    await edited.getByRole('button', { name: 'Poista' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Poistetaanko tekstilohko?');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Peruuta' }).click();
    await expect(page.locator('.text-block')).toHaveText('Muokattu teksti');
    await edited.getByRole('button', { name: 'Poista' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Poista' }).click();
    await expect(page.locator('.text-block')).toHaveCount(0);
  });

  test('tuplanapautus Lisää teksti -painikkeesta ei tee tuplaa', async ({ authedPage: page, api }) => {
    await page.goto(`/#/day/${TODAY}`);
    await page.getByPlaceholder('Mitä tänään tapahtui?').fill('Vain kerran');
    await page.getByRole('button', { name: 'Lisää teksti' }).dblclick();
    await expect(page.locator('.text-block')).toHaveCount(1);
    await page.waitForTimeout(500);
    expect((await api.get(`/api/entries/${TODAY}`)).text_blocks).toHaveLength(1);
  });

  test('tuplanapautus Tallenna paikka -painikkeesta ei tee tuplaa', async ({ authedPage: page, api }) => {
    await page.goto(`/#/day/${TODAY}`);
    await page.getByRole('button', { name: '+ Lisää paikka' }).click();
    await page.getByPlaceholder('Paikan nimi').fill('Tupla?');
    await page.getByRole('button', { name: 'Tallenna paikka' }).dblclick();
    await page.waitForTimeout(500);
    expect((await api.get(`/api/entries/${TODAY}`)).checkins).toHaveLength(1);
  });

  test('HTML ja skripti näkyvät tekstinä eivätkä suoritu (myös kartan ponnahdusikkunassa)', async ({ authedPage: page, api }) => {
    const xss = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    await api.post(`/api/entries/${TODAY}/texts`, { content: xss });
    await api.post(`/api/entries/${TODAY}/checkins`, { place_name: xss, latitude: 60.17, longitude: 24.94 });
    await page.goto('/#/');
    await expect(page.locator('.text-block')).toHaveText(xss);
    await expect(page.locator('.checkin')).toContainText(xss);
    await page.goto('/#/map');
    await page.locator('path.leaflet-interactive').first().click({ force: true });
    await expect(page.locator('.leaflet-popup-content')).toContainText(xss);
    // fixture kaataa testin, jos alert-dialogi aukesi
  });

  test('hyvin pitkä paikan nimi ei levitä sivua mobiilissa', async ({ authedPage: page, api }) => {
    await api.post(`/api/entries/${TODAY}/checkins`, { place_name: 'Pitkänimisenpaikan'.repeat(11).slice(0, 200) });
    await page.goto('/#/');
    await expect(page.locator('.checkin')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto(`/#/day/${TODAY}`);
    await expect(page.locator('.subcard strong')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('Kuvat', () => {
  test('useita kerralla, latausindikaattori, avaus isompana ja sulkeminen, poisto vahvistuksella', async ({ authedPage: page }) => {
    // Hidastetaan latausta, jotta indikaattori ehtii näkyä
    await page.route('**/api/entries/*/photos', async route => {
      await new Promise(r => setTimeout(r, 400));
      await route.continue();
    });
    await page.goto(`/#/day/${TODAY}`);
    const three = await files(2);
    three.push({ name: 'kuva3.png', mimeType: 'image/png', buffer: await png() });
    await page.locator('input[type=file]').setInputFiles(three);
    await expect(page.getByText(/Ladataan kuvaa \d\/3/)).toBeVisible();
    await expect(page.locator('.photo-item img')).toHaveCount(3, { timeout: 15000 });
    await expect(page.getByRole('button', { name: '+ Lisää kuvia' })).toBeEnabled();

    await page.locator('.photo-item .thumb').first().click();
    await expect(page.locator('.lightbox img')).toBeVisible();
    await page.locator('.lightbox').click();
    await expect(page.locator('.lightbox')).toHaveCount(0);

    await page.locator('.photo-item').first().getByRole('button', { name: 'Poista' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Poistetaanko kuva?');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Poista' }).click();
    await expect(page.locator('.photo-item img')).toHaveCount(2);
  });

  test('ei-kuvatiedosto antaa suomenkielisen virheen', async ({ authedPage: page }) => {
    await page.goto(`/#/day/${TODAY}`);
    await page.locator('input[type=file]').setInputFiles({ name: 'muistio.txt', mimeType: 'text/plain', buffer: Buffer.from('teksti') });
    await expect(page.locator('.error')).toContainText('Vain JPEG-, PNG- tai WebP-kuvat sallittu');
  });
});

test.describe('Paikat', () => {
  test('lisäys, muokkaus ja poisto vahvistuksella', async ({ authedPage: page }) => {
    await page.goto(`/#/day/${TODAY}`);
    await page.getByRole('button', { name: '+ Lisää paikka' }).click();
    await page.getByRole('button', { name: 'Tallenna paikka' }).click();
    await expect(page.locator('.checkin-form .error')).toHaveText('Anna paikalle nimi');
    await page.getByPlaceholder('Paikan nimi').fill('Kirjasto');
    await page.getByPlaceholder(/Kategoria/).fill('kirjasto');
    await page.getByRole('button', { name: 'Tallenna paikka' }).click();
    const row = page.locator('.subcard').filter({ hasText: 'Kirjasto' });
    await expect(row).toContainText('kirjasto');
    await expect(row).toContainText('(ei sijaintia)');

    await row.getByRole('button', { name: 'Muokkaa' }).click();
    await page.getByPlaceholder('Paikan nimi').fill('Pääkirjasto');
    await page.getByRole('button', { name: 'Tallenna paikka' }).click();
    const edited = page.locator('.subcard').filter({ hasText: 'Pääkirjasto' });
    await expect(edited).toBeVisible();

    await edited.getByRole('button', { name: 'Poista' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Poistetaanko Pääkirjasto?');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Poista' }).click();
    await expect(page.locator('.subcard').filter({ hasText: 'Pääkirjasto' })).toHaveCount(0);
  });

  test('paikan nimikenttään ei voi kirjoittaa yli 200 merkkiä', async ({ authedPage: page }) => {
    await page.goto(`/#/day/${TODAY}`);
    await page.getByRole('button', { name: '+ Lisää paikka' }).click();
    await page.getByPlaceholder('Paikan nimi').fill('x'.repeat(250));
    await expect(page.getByPlaceholder('Paikan nimi')).toHaveValue('x'.repeat(200));
  });
});
