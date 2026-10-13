// Express-sovellus ilman käynnistystä: server.js kuuntelee porttia, testit käyttävät suoraan.
import express from 'express';
import 'express-async-errors'; // Express 4: async-reittien virheet päätyvät virhekäsittelijään
import cors from 'cors';
import helmet from 'helmet';
import { authRouter, requireAuth } from './auth.js';
import { entriesRouter } from './routes/entries.js';
import { itemsRouter } from './routes/items.js';
import { summaryRouter } from './routes/summary.js';
import { geocodeRouter } from './routes/geocode.js';
import { exportRouter } from './routes/export.js';
import { favoritesRouter } from './routes/favorites.js';
import { pool } from './db.js';
import { isLocal, LOCAL_DIR } from './storage.js';

const app = express();
app.set('trust proxy', 1); // Render on proxyn takana
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean) }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// Vain paikallisessa kehityksessä (storage.js estää tämän tuotannossa)
if (isLocal) app.use('/dev-storage', express.static(LOCAL_DIR));

app.use('/api/auth', authRouter);
app.use('/api/entries', requireAuth, entriesRouter);
app.use('/api/summary', requireAuth, summaryRouter);
app.use('/api/geocode', requireAuth, geocodeRouter);
app.use('/api/export', requireAuth, exportRouter);
app.use('/api/favorites', requireAuth, favoritesRouter);
app.use('/api', requireAuth, itemsRouter);

app.use((err, _req, res, _next) => {
  // express.json: rikkinäinen tai liian suuri pyyntö on asiakkaan virhe, ei palvelinvirhe
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Virheellinen pyyntö' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Pyyntö on liian suuri' });
  console.error(err);
  if (res.headersSent) return res.destroy();
  res.status(500).json({ error: 'Palvelinvirhe' });
});

export default app;
