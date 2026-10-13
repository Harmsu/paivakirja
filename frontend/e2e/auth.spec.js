import { test, expect, loginViaUi } from './fixtures.js';

test.describe('Kirjautuminen', () => {
  test('väärät tunnukset ja tyhjät kentät antavat suomenkielisen virheen', async ({ page, credentials }) => {
    await page.goto('/');
    await loginViaUi(page, { username: credentials.username, password: 'väärä' });
    await expect(page.getByText('Väärä tunnus tai salasana')).toBeVisible();
    await loginViaUi(page, { username: '', password: '' });
    await expect(page.getByText('Väärä tunnus tai salasana')).toBeVisible();
    await expect(page.locator('.bottomnav')).toHaveCount(0);
  });

  test('oikeat tunnukset, päivitys pitää kirjautuneena, uloskirjautuminen piilottaa sisällön', async ({ page, credentials, api }) => {
    await api.post('/api/entries/2026-10-13/texts', { content: 'Salainen merkintä' });
    await page.goto('/');
    await loginViaUi(page, credentials);
    await expect(page.getByText('Salainen merkintä')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Salainen merkintä')).toBeVisible();

    await page.getByRole('link', { name: 'Asetukset' }).click();
    await page.getByRole('button', { name: 'Kirjaudu ulos' }).click();
    await expect(page.getByRole('button', { name: 'Kirjaudu' })).toBeVisible();
    await expect(page.getByText('Salainen merkintä')).toHaveCount(0);
    await page.goto('/#/');
    await expect(page.getByText('Salainen merkintä')).toHaveCount(0);
  });

  test('suora osoite kirjautumattomana näyttää kirjautumisen ja sen jälkeen pyydetyn näkymän', async ({ page, credentials }) => {
    await page.goto('/#/favorites');
    await expect(page.getByRole('button', { name: 'Kirjaudu' })).toBeVisible();
    await expect(page.getByText('Suosikkipaikat')).toHaveCount(0);
    await loginViaUi(page, credentials);
    await expect(page.getByRole('heading', { name: /Suosikkipaikat/ })).toBeVisible();
  });
});
