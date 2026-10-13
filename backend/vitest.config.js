import { defineConfig } from 'vitest/config';
import { loadTestEnv } from './test/env.js';

const env = loadTestEnv();

export default defineConfig({
  test: {
    env,
    include: ['test/**/*.test.js'],
    globalSetup: './test/global-setup.js',
    fileParallelism: false, // yksi yhteinen testikanta
    testTimeout: 30000,
    hookTimeout: 180000,
  },
});
