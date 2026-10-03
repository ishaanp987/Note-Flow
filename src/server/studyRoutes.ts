import { Router } from 'express';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { Store } from './storage';
import { Jobs } from './jobs';
import { Settings } from './settings';
import { mediaLocks } from './mediaRoutes';
import { formatTime, markdown } from '../shared/lecture';
export function studyRoutes(store: Store, jobs: Jobs, settings: Settings) {
  const router = Router();
  router.get('/settings', async (_req, res) => res.json({ ...settings.public(), readiness: await settings.readiness() }));
  router.put('/settings', (req, res) => res.json(settings.save(req.body)));
  router.post('/lectures/:id/process', async (req, res) => {
    const p = z.object({ engine: z.enum(['groq', 'local']), notesOnly: z.boolean().default(false) }).parse(req.body);
    res.status(202).json(await jobs.start(req.params.id, p.engine, p.notesOnly));
  });
  router.post('/lectures/:id/stop', (req, res) => { store.get(req.params.id); jobs.stop(req.params.id); res.json({ stopped: true }); });
  router.patch('/lectures/:id/transcript', (req, res) => {
    const p = z.object({ version: z.number(), segments: z.array(z.object({ id: z.string(), text: z.string().max(50000) })).max(10000) }).parse(req.body);
    const l = store.get(req.params.id); if (l.transcriptVersion !== p.version) throw new Error('The transcript changed in another window. Reload before editing.');
    const edits = new Map(p.segments.map(s => [s.id, s.text]));
    if (edits.size !== l.segments.length || edits.size !== p.segments.length || l.segments.some(s => !edits.has(s.id))) throw new Error('Keep the original transcript segment IDs when editing.');
    res.json(store.update(l.id, { segments: l.segments.map(s => ({ ...s, text: edits.get(s.id)! })), transcriptVersion: l.transcriptVersion + 1, sectionNotes: {}, sectionCandidates: {}, draft: null, message: 'Transcript edits saved. Generate notes again to use these changes.' }));
  });
  router.patch('/lectures/:id/notes', (req, res) => {
    const p = z.object({ markdown: z.string().max(500000), revision: z.number() }).parse(req.body); const l = store.get(req.params.id);
    if ((l.notesRevision || 0) !== p.revision) throw new Error('Saved notes changed in another window. Reload before saving.');
    if (!l.notes) throw new Error('Generate notes before editing.');
    res.json(store.update(l.id, { notesMarkdown: p.markdown, notesEdited: true, notesRevision: (l.notesRevision || 0) + 1, message: 'Your note edits are saved.' }));
  });
  router.post('/lectures/:id/draft', (req, res) => {
    const l = store.get(req.params.id); const p = z.object({ accept: z.boolean() }).parse(req.body);
    if (!l.draft) throw new Error('No generated draft is available.');
    res.json(store.update(l.id, p.accept ? { notes: l.draft, notesMarkdown: markdown(l.draft), notesVersion: l.draftVersion, notesEdited: false, notesRevision: (l.notesRevision || 0) + 1, draft: null, message: 'The generated draft replaced your saved notes.' } : { draft: null, message: 'Draft discarded. Your saved notes were kept.' }));
  });
  router.get('/lectures/:id/export', (req, res) => {
    const l = store.get(req.params.id); const transcript = req.query.type === 'transcript';
    if (transcript ? !l.segments.length : !l.notesMarkdown) throw new Error('There is no generated content to export yet.');
    const filename = l.title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 100) || 'lecture';
    const text = transcript ? l.segments.map(s => `[${formatTime(s.startSeconds)}] ${s.text}`).join('\n\n') : `# ${l.title}\n\n${l.notesMarkdown}\n\n## Transcript references\n\n${l.notes?.sections.map(s => `- ${s.heading}: ${s.sourceSegmentIds.map(id => { const seg = l.segments.find(x => x.id === id); return seg ? formatTime(seg.startSeconds) : id; }).join(', ')}`).join('\n') || ''}`;
    res.type('text/plain').attachment(`${filename}${transcript ? '.txt' : '.md'}`).send(text);
  });
  router.delete('/lectures/:id', async (req, res) => {
    const l = store.get(req.params.id); if (jobs.isActive(l.id) || mediaLocks.has(l.id) || l.status === 'recording') throw new Error('Stop recording or processing before deleting this lecture.');
    const target = path.resolve(store.folder(l.id)); const root = path.resolve(store.dir) + path.sep;
    if (!target.startsWith(root) || !/^[a-f\d-]{36}$/.test(l.id)) throw new Error('The lecture folder could not be verified.');
    await rm(target, { recursive: true, force: true }); store.delete(l.id); res.json({ deleted: true });
  });
  return router;
}
