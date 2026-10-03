import express from 'express';
import { createServer } from 'vite';
import path from 'node:path';
import { Store } from './storage';
import { createApp } from './app';

const store = new Store(path.resolve(process.env.LECTURE_DATA_DIR || 'data'));
const port = Number(process.env.PORT || 3100);
store.recover();
const app = createApp(store);
if (process.argv.includes('--production')) {
  app.use(express.static(path.resolve('dist/client')));
  app.get('/{*page}', (_req, res) => res.sendFile(path.resolve('dist/client/index.html')));
} else {
  const vite = await createServer({ server: { host: '127.0.0.1', middlewareMode: true, hmr: { host: '127.0.0.1', port: port + 10000 } }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.listen(port, '127.0.0.1', () => console.log(`Lecture Notes: http://127.0.0.1:${port}`));
