import { test, expect, TODAY } from './fixtures.js';

test.describe('Suosikit', () => {
  test('tyhjän tilan ohjeteksti Suosikit-näkymässä', async ({ authedPage: page }) => {
    await page.goto('/#/favorites');
    await expect(page.getByText('Ei vielä suosikkipaikkoja.')).toBeVisible();
    await expect(page.getByText(/napauttamalla ☆-tähteä/)).toBeVisible();
  });

  test('tallennus suosikiksi checkinin yhteydessä', async ({ authedPage: page, api }) => {
    await page.goto(`/#/day/${TODAY}`);
    await page.getByRole('button', { name: '+ Lisää paikka' }).click();
    await page.getByPlaceholder('Paikan nimi').fill('Lähikirjasto');
    await page.getByText('☆ Tallenna myös suosikkeihin').click();
    await page.getByRole('button', { name: 'Tallenna paikka' }).click();
    await expect(page.locator('.notice')).toHaveText('★ Lähikirjasto lisätty suosikkeihin');
    await expect(page.locator('button.star.on')).toHaveCount(1);
    expect((await api.get('/api/favorites')).map(f => f.name)).toEqual(['Lähikirjasto']);
  });

  test('tähti jo tehdylle checkinille ja duplikaatista ilmoitus', async ({ authedPage: page, api }) => {
    await api.post(`/api/entries/${TODAY}/checkins`, { place_name: 'Uimahalli', category: 'uimahalli', latitude: 65.05, longitude: 25.47 });
    await page.goto(`/#/day/${TODAY}`);
    await page.getByRole('button', { name: 'Lisää suosikkeihin' }).click();
    await expect(page.locator('.notice')).toHaveText('★ Uimahalli lisätty suosikkeihin');
    await page.getByRole('button', { name: 'Lisää suosikkeihin' }).click();
    await expect(page.locator('.notice')).toHaveText('★ Uimahalli on jo suosikeissa');
    const favs = await api.get('/api/favorites');
    expect(favs).toHaveLength(1);
    expect(favs[0]).toMatchObject({ category: 'uimahalli', latitude: 65.05 });
  });

  test('Valitse suosikeista täyttää kentät, niitä voi muokata, eniten käytetyt ensin', async ({ authedPage: page, api }) => {
    const a = await api.post('/api/favorites', { name: 'Apteekki', category: 'apteekki' });
    const k = await api.post('/api/favorites', { name: 'Kuntosali', category: 'kuntosali', latitude: 65.01, longitude: 25.49 });
    await api.post('/api/entries/2026-10-01/checkins', { place_name: 'Kuntosali', favorite_id: k.id });
    await page.goto(`/#/day/${TODAY}`);
    await page.getByRole('button', { name: '+ Lisää paikka' }).click();
    await page.getByRole('button', { name: '★ Valitse suosikeista' }).click();
    const items = page.locator('.fav-item');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText('Kuntosali');
    await expect(items.first()).toContainText('1×');
    await items.first().click();
    await expect(page.getByPlaceholder('Paikan nimi')).toHaveValue('Kuntosali');
    await expect(page.getByPlaceholder(/Kategoria/)).toHaveValue('kuntosali');
    await expect(page.locator('.checkin-form .coords')).toContainText('65,01000, 25,49000');
    await expect(page.getByText('★ Tämä paikka on suosikeissa')).toBeVisible();
    await page.getByPlaceholder(/Kategoria/).fill('salitreeni');
    await page.getByRole('button', { name: 'Tallenna paikka' }).click();
    await expect(page.locator('.subcard').filter({ hasText: 'salitreeni' })).toBeVisible();

    const c = (await api.get(`/api/entries/${TODAY}`)).checkins[0];
    expect(c).toMatchObject({ place_name: 'Kuntosali', category: 'salitreeni', latitude: 65.01, longitude: 25.49 });
    const favs = await api.get('/api/favorites');
    expect(favs.find(f => f.id === k.id)).toMatchObject({ use_count: 2, category: 'kuntosali' });
    expect(favs.find(f => f.id === a.id).use_count).toBe(0);
  });

  test('suodatuskenttä yli 15 suosikilla: ääkköset ja tyhjä tulos', async ({ authedPage: page, api }) => {
    const names = Array.from({ length: 15 }, (_, i) => `Paikka ${String(i + 1).padStart(2, '0')}`);
    names.push('Äänekosken kirjasto');
    for (const name of names) await api.post('/api/favorites', { name });
    await page.goto(`/#/day/${TODAY}`);
    await page.getByRole('button', { name: '+ Lisää paikka' }).click();
    await page.getByRole('button', { name: '★ Valitse suosikeista' }).click();
    await expect(page.locator('.fav-item')).toHaveCount(16);
    const filter = page.getByPlaceholder('Suodata…');
    await filter.fill('ääne');
    await expect(page.locator('.fav-item')).toHaveCount(1);
    await expect(page.locator('.fav-item')).toContainText('Äänekosken kirjasto');
    await filter.fill('ÄÄNEKOSKEN');
    await expect(page.locator('.fav-item')).toHaveCount(1);
    await filter.fill('zzz');
    await expect(page.locator('.fav-item')).toHaveCount(0);
    await expect(page.getByText('Ei osumia')).toBeVisible();
    await filter.press('Enter'); // ei saa lähettää paikkalomaketta
    expect((await api.get(`/api/entries/${TODAY}`)).checkins).toHaveLength(0);
  });

  test('Suosikit-näkymä: lisäys, muokkaus (tyhjä nimi hylätään), poiston peruutus ja poisto', async ({ authedPage: page, api }) => {
    await page.goto('/#/favorites');
    await page.getByRole('button', { name: '+ Lisää suosikki' }).click();
    await page.getByPlaceholder('Paikan nimi').fill('Mökki');
    await page.getByRole('button', { name: 'Tallenna suosikki' }).click();
    const row = page.locator('.fav-row').filter({ hasText: 'Mökki' });
    await expect(row).toContainText('ei vielä käytetty');

    await row.getByRole('button', { name: 'Muokkaa' }).click();
    await page.getByPlaceholder('Paikan nimi').fill('');
    await page.getByRole('button', { name: 'Tallenna muutokset' }).click();
    await expect(page.locator('.checkin-form .error')).toHaveText('Anna paikalle nimi');
    await page.getByPlaceholder('Paikan nimi').fill('Kesämökki');
    await page.getByRole('button', { name: 'Tallenna muutokset' }).click();
    const edited = page.locator('.fav-row').filter({ hasText: 'Kesämökki' });
    await expect(edited).toBeVisible();

    await edited.getByRole('button', { name: 'Poista' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Aiemmat kirjaukset säilyvät');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Peruuta' }).click();
    await expect(edited).toBeVisible();
    expect(await api.get('/api/favorites')).toHaveLength(1);
    await edited.getByRole('button', { name: 'Poista' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Poista' }).click();
    await expect(page.getByText('Ei vielä suosikkipaikkoja.')).toBeVisible();
  });
});
