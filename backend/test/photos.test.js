import { describe, it, expect, beforeEach } from 'vitest';
import sharp from 'sharp';
import { api, authed, reset } from './helpers.js';
import { jpeg, png } from './seed.js';

const D = '2026-06-01';

describe('Kuvat', () => {
  let a;
  beforeEach(async () => { await reset(); a = await authed(); });
  const upload = (buf, name, type, caption) => {
    const r = a.post(`/api/entries/${D}/photos`).attach('file', buf, { filename: name, contentType: type });
    return caption === undefined ? r : r.field('caption', caption);
  };

  it('JPG ja PNG latautuvat ja pienennetään (pitkä sivu max 1600, pienoiskuva 400)', async () => {
    const j = await upload(await jpeg(3000, 2000), 'iso.jpg', 'image/jpeg');
    expect(j.status).toBe(201);
    expect([j.body.width, j.body.height]).toEqual([1600, 1067]);
    const p = await upload(await png(640, 480), 'pieni.png', 'image/png');
    expect(p.status).toBe(201);
    expect([p.body.width, p.body.height]).toEqual([640, 480]);
    const thumb = await api().get(j.body.thumb_url);
    expect(thumb.status).toBe(200);
    const meta = await sharp(thumb.body).metadata();
    expect(Math.max(meta.width, meta.height)).toBe(400);
    expect(meta.format).toBe('jpeg');
  });

  it('ei-kuvatiedosto hylätään selkeällä suomenkielisellä virheellä', async () => {
    const t = await upload(Buffer.from('tämä on tekstiä'), 'muistio.txt', 'text/plain');
    expect(t.status).toBe(400);
    expect(t.body.error).toBe('Vain JPEG-, PNG- tai WebP-kuvat sallittu');
    const fake = await upload(Buffer.from('ei oikeasti jpeg'), 'feikki.jpg', 'image/jpeg');
    expect(fake.status).toBe(400);
    expect(fake.body.error).toMatch(/Kuvan käsittely epäonnistui/);
    expect((await a.post(`/api/entries/${D}/photos`)).body.error).toBe('Kuva puuttuu');
  });

  it('liian suuri tiedosto (> 25 Mt) hylätään', async () => {
    const r = await upload(Buffer.alloc(26 * 1024 * 1024, 1), 'jattikuva.jpg', 'image/jpeg');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Kuva on liian suuri (max 25 Mt)');
  });

  it('kuvateksti on valinnainen, muokattavissa ja tyhjennettävissä', async () => {
    const ilman = (await upload(await jpeg(), 'a.jpg', 'image/jpeg')).body;
    expect(ilman.caption).toBeNull();
    const kanssa = (await upload(await jpeg(), 'b.jpg', 'image/jpeg', 'Auringonlasku')).body;
    expect(kanssa.caption).toBe('Auringonlasku');
    expect((await a.put(`/api/photos/${kanssa.id}`).send({ caption: 'Uusi teksti' })).body.caption).toBe('Uusi teksti');
    expect((await a.put(`/api/photos/${kanssa.id}`).send({ caption: '' })).body.caption).toBeNull();
  });

  it('järjestys säilyy ja vaihtuu; poisto poistaa kuvan ja tiedostot', async () => {
    const ids = [];
    for (const n of ['1', '2', '3']) ids.push((await upload(await jpeg(), `${n}.jpg`, 'image/jpeg', n)).body.id);
    let day = (await a.get(`/api/entries/${D}`)).body;
    expect(day.photos.map(p => p.caption)).toEqual(['1', '2', '3']);
    await a.put(`/api/entries/${D}/order`).send({ photos: [ids[1], ids[2], ids[0]] });
    day = (await a.get(`/api/entries/${D}`)).body;
    expect(day.photos.map(p => p.caption)).toEqual(['2', '3', '1']);
    const removed = day.photos[0];
    expect((await a.delete(`/api/photos/${removed.id}`)).status).toBe(204);
    expect((await api().get(removed.url)).status).toBe(404);
    expect((await api().get(removed.thumb_url)).status).toBe(404);
    expect((await a.get(`/api/entries/${D}`)).body.photos).toHaveLength(2);
  });

  it('TULKINTA: kuvan osoite ilman tokenia', async () => {
    const p = (await upload(await jpeg(), 'a.jpg', 'image/jpeg')).body;
    // Paikallisessa kehitys-/testitallennuksessa (/dev-storage) kuvat ovat ilman tokenia saatavilla.
    // Tuotannossa (Object Storage) osoitteet ovat allekirjoitettuja ja vanhenevia; tämä testataan käsin.
    expect(p.url.startsWith('/dev-storage/')).toBe(true);
    expect((await api().get(p.url)).status).toBe(200);
  });
});
