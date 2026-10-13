import { describe, it, expect, beforeAll } from 'vitest';
import { authed, reset, seedClient } from './helpers.js';
import { seed } from './seed.js';

// Kiinteä "tänään", jotta luvut ovat ennustettavia: 13.10.2026
const TODAY = '2026-10-13';

describe('Näkymien data (testidata)', () => {
  let a; let d;
  beforeAll(async () => { await reset(); d = await seed(await seedClient(), TODAY); a = await authed(); });
  const days = q => a.get(`/api/summary/days?${q}`).then(r => r.body);

  it('aikajana: uusimmasta vanhimpaan, sivutus', async () => {
    const all = (await a.get('/api/entries?limit=100')).body.map(e => e.date);
    expect(all).toEqual([...all].sort().reverse());
    expect(all).toHaveLength(8);
    const p1 = (await a.get('/api/entries?limit=4')).body;
    const p2 = (await a.get(`/api/entries?limit=4&before=${p1[3].date}`)).body;
    expect([...p1, ...p2].map(e => e.date)).toEqual(all.slice(0, 8));
  });

  it('kuukausi-koonti täsmää testidataan', async () => {
    const oct = await days('from=2026-10-01&to=2026-10-31');
    expect(oct.map(x => x.date)).toEqual([d.weekAgo, d.yesterday, d.today]);
    const t = oct.find(x => x.date === d.today);
    expect(t).toMatchObject({ texts: 2, photos: 3, checkins: 2 });
    expect(t.places).toEqual(['Linnanmaan uimahalli', 'Kahvila Kaarna']);
    expect(t.thumb_url).toBeTruthy();
    const sep = await days('from=2026-09-01&to=2026-09-30');
    expect(sep).toEqual([expect.objectContaining({ date: d.monthAgo, checkins: 1, places: ['Mökki'] })]);
  });

  it('tyhjä kuukausi palauttaa tyhjän; vuoden vaihde menee oikeaan vuoteen', async () => {
    expect(await days('from=2026-03-01&to=2026-03-31')).toEqual([]);
    expect((await days('from=2025-12-01&to=2025-12-31')).map(x => x.date)).toEqual(['2025-12-31']);
    expect((await days('from=2026-01-01&to=2026-01-31')).map(x => x.date)).toEqual(['2026-01-01']);
    expect((await days('from=2026-01-01&to=2026-12-31')).map(x => x.date)).not.toContain('2025-12-31');
  });

  it('vuosi-koonti: summat täsmäävät kuukausien summiin, vuosi ilman dataa on tyhjä', async () => {
    const year = await days('from=2026-01-01&to=2026-12-31');
    let monthSum = 0;
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const last = new Date(2026, m, 0).getDate();
      monthSum += (await days(`from=2026-${mm}-01&to=2026-${mm}-${last}`)).length;
    }
    expect(year.length).toBe(monthSum);
    const sum = k => year.reduce((s, x) => s + x[k], 0);
    expect([sum('texts'), sum('photos'), sum('checkins')]).toEqual([4, 4, 3]);
    expect(await days('from=2019-01-01&to=2019-12-31')).toEqual([]);
  });

  it('tänä päivänä: sama päivä eri vuosilta, 29.2. ja tyhjä päivä eivät kaada', async () => {
    const otd = (await a.get('/api/entries/on-this-day?month=10&day=13')).body;
    expect(otd.map(e => e.date)).toEqual([d.today, d.lastYear, d.twoYearsAgo]);
    const leap = await a.get('/api/entries/on-this-day?month=2&day=29');
    expect(leap.status).toBe(200);
    expect(leap.body).toEqual([]);
    expect((await a.get('/api/entries/on-this-day?month=7&day=7')).body).toEqual([]);
    expect((await a.get('/api/entries/on-this-day?month=13&day=1')).status).toBe(400);
    const sameMonth = await days('month=10');
    expect(sameMonth.map(x => x.date.slice(0, 4))).toEqual(['2024', '2025', '2026', '2026', '2026']);
  });

  it('kartta: vain koordinaatilliset, suodatus, käänteinen ja tyhjä väli', async () => {
    const all = (await a.get('/api/summary/map')).body;
    expect(all.map(p => p.place_name).sort()).toEqual(['Kahvila Kaarna', 'Kiasma', 'Linnanmaan uimahalli', 'Uudenvuoden juhla']);
    expect(all.every(p => typeof p.latitude === 'number')).toBe(true);
    const oct = (await a.get('/api/summary/map?from=2026-10-01&to=2026-10-31')).body;
    expect(oct).toHaveLength(2);
    const reversed = await a.get('/api/summary/map?from=2026-10-31&to=2026-10-01');
    expect(reversed.status).toBe(200);
    expect(reversed.body).toEqual([]);
    expect((await a.get('/api/summary/map?from=2020-01-01&to=2020-12-31')).body).toEqual([]);
    expect((await a.get('/api/summary/map?from=eilen')).status).toBe(400);
  });
});
