import pg from 'pg';
import 'dotenv/config';

const { Pool, types } = pg;

// DATE palautetaan sellaisenaan 'YYYY-MM-DD'-merkkijonona. Oletusparseri tekee siitä
// paikallisen Date-olion, joka toISOString():n jälkeen siirtyy päivällä (uintiharjoittelun bugi).
types.setTypeParser(types.builtins.DATE, v => v);
// NUMERIC (vain koordinaatit) numeroiksi
types.setTypeParser(types.builtins.NUMERIC, v => (v === null ? null : parseFloat(v)));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5,
});
// Joutilaan yhteyden katkeaminen (esim. Postgresin uudelleenkäynnistys) ei saa kaataa prosessia;
// pool avaa uuden yhteyden seuraavaan kyselyyn.
pool.on('error', err => console.error('Tietokantayhteys katkesi:', err.code || err.message));

export const query = (text, params) => pool.query(text, params);
