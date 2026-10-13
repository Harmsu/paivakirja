import 'dotenv/config';
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
import { pool } from './db.js';
import { isLocal, LOCAL_DIR, storageConfigured } from './storage.js';

for (const key of ['DATABASE_URL', 'JWT_SECRET', 'APP_USERNAME', 'APP_PASSWORD_HASH']) {
  if (!process.env[key]) {
    console.error(`Puuttuva ympäristömuuttuja: ${key}`);
    process.exit(1);
  }
}
if (!storageConfigured) console.warn('Kuvatallennusta ei ole määritetty (S3_*), kuvien lataus ei toimi');

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
app.use('/api', requireAuth, itemsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return res.destroy();
  res.status(500).json({ error: 'Palvelinvirhe' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Paikka- ja kuvapäiväkirja backend kuuntelee portissa ${port}`));
