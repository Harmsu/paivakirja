// Yhteinen testidata API- ja selaintesteille. `client` on sovitin:
//   post(path, body) -> vastauksen JSON, upload(path, { name, mimeType, buffer }) -> JSON
import sharp from 'sharp';

const pad = n => String(n).padStart(2, '0');

// Päivämäärät Suomen aikavyöhykkeellä (sama kuin käyttäjän puhelimella)
export function helsinkiToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(now);
}
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
export const shiftYears = (iso, n) => `${Number(iso.slice(0, 4)) + n}${iso.slice(4)}`;

export async function jpeg(w = 1200, h = 800, color = '#e8730c') {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg().toBuffer();
}
export async function png(w = 640, h = 480, color = '#2f7d4f') {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();
}

export function seedDates(today = helsinkiToday()) {
  const year = Number(today.slice(0, 4));
  return {
    today,
    yesterday: addDays(today, -1),
    weekAgo: addDays(today, -7),
    monthAgo: addDays(today, -30),
    lastYear: shiftYears(today, -1),
    twoYearsAgo: shiftYears(today, -2),
    newYearsEve: `${year - 1}-12-31`,
    newYearsDay: `${year}-01-01`,
  };
}

// Speksin testidata: tänään (2 tekstiä, 3 kuvaa, 2 paikkaa), eilen (vain teksti),
// 7 pv sitten (vain kuva), 30 pv sitten (vain paikka ilman koordinaatteja), sama päivä
// viime vuonna (teksti, kuva, paikka), kaksi vuotta sitten (vain teksti), 31.12. ja 1.1.
export async function seed(client, today = helsinkiToday()) {
  const d = seedDates(today);
  const img = { name: 'kuva.jpg', mimeType: 'image/jpeg', buffer: await jpeg() };
  const e = date => `/api/entries/${date}`;

  await client.post(`${e(d.today)}/texts`, { content: 'Aamulla kävin uimassa.' });
  await client.post(`${e(d.today)}/texts`, { content: 'Illalla luin kirjaa.' });
  for (let i = 0; i < 3; i++) await client.upload(`${e(d.today)}/photos`, img);
  await client.post(`${e(d.today)}/checkins`, {
    place_name: 'Linnanmaan uimahalli', category: 'uimahalli', latitude: 65.05447, longitude: 25.47233,
  });
  await client.post(`${e(d.today)}/checkins`, {
    place_name: 'Kahvila Kaarna', category: 'kahvila', latitude: 65.0121, longitude: 25.4651,
  });
  await client.post(`${e(d.yesterday)}/texts`, { content: 'Eilen satoi koko päivän.' });
  await client.upload(`${e(d.weekAgo)}/photos`, img);
  await client.post(`${e(d.monthAgo)}/checkins`, { place_name: 'Mökki' });
  await client.post(`${e(d.lastYear)}/texts`, { content: 'Vuosi sitten Helsingissä.' });
  await client.upload(`${e(d.lastYear)}/photos`, img);
  await client.post(`${e(d.lastYear)}/checkins`, {
    place_name: 'Kiasma', category: 'museo', latitude: 60.1717, longitude: 24.9364,
  });
  await client.post(`${e(d.twoYearsAgo)}/texts`, { content: 'Kaksi vuotta sitten.' });
  await client.post(`${e(d.newYearsEve)}/checkins`, {
    place_name: 'Uudenvuoden juhla', latitude: 60.1699, longitude: 24.9384,
  });
  await client.post(`${e(d.newYearsDay)}/texts`, { content: 'Hyvää uutta vuotta!' });
  return d;
}
