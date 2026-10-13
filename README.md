# Paikka- ja kuvapäiväkirja

Henkilökohtainen päiväkirja: päivän tekstit, kuvat ja paikkakirjaukset (Momento + Swarm).
React + Vite PWA (Netlify), Node/Express (Render), PostgreSQL (UpCloud), kuvat UpCloud Object Storageen.

## Rakenne
- `backend/migrations/` – skeema (entries, text_blocks, photos, checkins). Uusi muutos = uusi tiedosto.
- `backend/src/routes/` – entries (päivät, lisäykset, järjestys), items (muokkaus/poisto),
  summary (koonnit + kartta), geocode (Nominatim-välitys), export (zip-vienti)
- `backend/src/storage.js` – S3-tallennus (presigned URL:t), paikallinen levy vain kehitykseen
- `backend/src/images.js` – sharp: EXIF-kierto, max 1600 px / JPEG 80 %, pienoiskuva 400 px
- `frontend/src/views/` – Päivät, Päivä (muokkaus), Kuukausi, Vuosi, Tänä päivänä, Kartta, Asetukset

## Paikallinen kehitys
```bash
cd backend && cp .env.example .env   # täytä arvot
npm install
npm run hash-password -- "salasana"  # tulos APP_PASSWORD_HASH:iin
npm run migrate
npm run dev

cd frontend && cp .env.example .env
npm install
npm run dev
```
Ilman Object Storage -bucketia kuvia voi testata asettamalla `.env`:iin `STORAGE_DRIVER=local`
(estetty tuotannossa, `NODE_ENV=production`).

## Julkaisu
- Backend: Render (`render.yaml`). Migraatiot ajetaan käynnistyksessä (`npm run migrate && npm start`).
  Ympäristömuuttujat: DATABASE_URL (ilman `?sslmode=`-parametria), APP_USERNAME, APP_PASSWORD_HASH,
  CORS_ORIGIN, S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
- Frontend: Netlify, base directory `frontend`, `VITE_API_URL` = backendin osoite (ilman `/api`).

## Vientiformaatti (zip)
`data.json` (`format: paikka-ja-kuvapaivakirja-export`, `version: 1`) + `photos/*.jpg`.
`entries[]` sisältää päivän sarakkeet ja sisäkkäin `text_blocks`, `photos` (`file` = polku zipissä)
ja `checkins` samoilla sarakenimillä kuin tietokannassa, joten tuonti voidaan tehdä myöhemmin.

## Varmuuskopiot
- Tietokanta: UpCloud-palvelimen yöllinen `/usr/local/bin/pg_backup.sh` (pg_dump → Google Drive, 14 vrk),
  `paivakirja` lisätty sen tietokantalistaan.
- Kuvat (Object Storage) eivät kuulu yölliseen varmuuskopioon: ota "Vie data" -zip säännöllisesti.
