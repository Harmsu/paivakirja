import 'dotenv/config';
import app from './app.js';
import { storageConfigured } from './storage.js';

for (const key of ['DATABASE_URL', 'JWT_SECRET', 'APP_USERNAME', 'APP_PASSWORD_HASH']) {
  if (!process.env[key]) {
    console.error(`Puuttuva ympäristömuuttuja: ${key}`);
    process.exit(1);
  }
}
if (!storageConfigured) console.warn('Kuvatallennusta ei ole määritetty (S3_*), kuvien lataus ei toimi');

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Paikka- ja kuvapäiväkirja backend kuuntelee portissa ${port}`));
