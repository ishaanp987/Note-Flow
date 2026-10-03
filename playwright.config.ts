import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({
  testDir: 'tests/e2e', timeout: 60000, fullyParallel: false, workers: 1,
  webServer: { command: `"${process.execPath}" node_modules/tsx/dist/cli.mjs src/server/index.ts`, url: 'http://127.0.0.1:3101/api/health', env: { PORT: '3101', LECTURE_DATA_DIR: path.resolve('work/e2e-data') }, reuseExistingServer: false, timeout: 30000 },
  use: { baseURL: 'http://127.0.0.1:3101', viewport: { width: 1280, height: 900 }, launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } },
  reporter: 'list'
});
