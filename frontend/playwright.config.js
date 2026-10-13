// Selaintestit: oma backend (3101) ja frontend (5174) testikantaa vasten,
// puhelin- ja työpöytäkokoisella Chromiumilla. Ks. README "Testit".
import { defineConfig, devices } from '@playwright/test';
import { loadTestEnv } from '../backend/test/env.js';

export const API_PORT = 3101;
export const WEB_PORT = 5174;
const env = loadTestEnv();

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  workers: 1, // yksi yhteinen testikanta
  fullyParallel: false,
  timeout: 45000,
  expect: { timeout: 8000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'fi-FI',
    timezoneId: 'Europe/Helsinki',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'puhelin', use: { ...devices['Pixel 7'] } },
    { name: 'tyopoyta', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: 'node ../backend/src/server.js',
      port: API_PORT,
      env: { ...env, PORT: String(API_PORT), CORS_ORIGIN: `http://localhost:${WEB_PORT}` },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
