import express from 'express';
import { randomBytes } from 'node:crypto';
import { ZodError } from 'zod';
import { Store } from './storage';
import { health } from './health';
import { mediaRoutes } from './mediaRoutes';
import { Settings } from './settings';
import { Jobs } from './jobs';
import { studyRoutes } from './studyRoutes';

export function createApp(store: Store, settings = new Settings(store.dir), jobs = new Jobs(store, settings)) {
  const app = express(); const token = randomBytes(32).toString('hex');
  app.use('/api', (req, res, next) => {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) { res.status(403).json({ error: 'Use the local app address.' }); return; }
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) throw new Error(); }
      catch { res.status(403).json({ error: 'This request did not come from the local app.' }); return; }
    }
    res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-lecture-token'] !== token) { res.status(403).json({ error: 'Reload the app before saving changes.' }); return; }
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/health', (_req, res) => res.json(health()));
  app.get('/api/bootstrap', (_req, res) => res.json({ token }));
  app.get('/api/lectures', (_req, res) => res.json(store.list().map(l => ({ ...l, chunkResults: {}, sectionNotes: {}, sectionCandidates: {} }))));
  app.post('/api/lectures', (req, res) => res.status(201).json(store.create(req.body)));
  app.get('/api/lectures/:id', (req, res) => res.json(store.get(req.params.id)));
  app.use('/api/lectures', mediaRoutes(store));
  app.use('/api', studyRoutes(store, jobs, settings));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'This action could not be found.' }));
  app.use((error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) { next(error); return; }
    const message = error instanceof ZodError ? error.issues[0]?.message : error.message;
    const safe = String(message || 'This action failed. Your saved recording is still available.').replace(/gsk_[\w-]+/g, '[redacted]');
    res.status(message === 'Lecture not found.' ? 404 : 400).json({ error: safe });
  });
  return app;
}
