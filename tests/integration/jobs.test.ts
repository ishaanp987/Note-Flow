import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/server/storage';
import { Settings } from '../../src/server/settings';
import { Jobs } from '../../src/server/jobs';
import { QuotaError, type Provider } from '../../src/server/providers/contracts';
import { runProcess, ffmpeg } from '../../src/server/audio';
let dir: string, store: Store, settings: Settings;
beforeAll(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'lecture-jobs-')); store = new Store(dir); settings = new Settings(dir); });
afterAll(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
const fixtureProvider: Provider = {
  async transcribe() { return [{ start: 0, end: 1, text: 'A cell is a unit of life.' }]; },
  async notes(segments) { return { summary: 'Cells are units of life.', sections: [{ heading: 'Cells', body: 'A cell is a unit of life.', sourceSegmentIds: segments.map(s => s.id) }] }; }
};
async function wait(j: Jobs) { for (let i = 0; i < 200 && j.active.size; i++) await new Promise(r => setTimeout(r, 10)); expect(j.active.size).toBe(0); }
test('quota exhaustion preserves the audio and completed transcript work', async () => {
  const l = store.create({ title: 'Quota test' }); const file = path.join(store.folder(l.id), 'original.wav'); await runProcess(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=duration=2', file]);
  store.update(l.id, { audioFile: 'original.wav', duration: 2 }); const j = new Jobs(store, settings, { ...fixtureProvider, async notes() { throw new QuotaError(Date.now() + 60000); } });
  const originalBytes = readFileSync(file);
  await j.start(l.id, 'groq'); await wait(j);
  expect(store.get(l.id)).toMatchObject({ status: 'waiting', audioFile: 'original.wav' }); expect(store.get(l.id).segments).toHaveLength(1);
  expect(readFileSync(file)).toEqual(originalBytes);
});
test('regeneration creates a draft and preserves manually edited saved notes', async () => {
  const l = store.create({ title: 'Draft test' }); const original = { summary: 'Original', sections: [{ heading: 'Original', body: 'Original', sourceSegmentIds: ['s1'] }] };
  store.update(l.id, { audioFile: 'original.wav', segments: [{ id: 's1', startSeconds: 0, endSeconds: 1, text: 'Cells' }], notes: original, notesMarkdown: 'My handwritten notes', notesEdited: true, transcriptVersion: 1 });
  const j = new Jobs(store, settings, fixtureProvider); await j.start(l.id, 'local', true); await wait(j);
  expect(store.get(l.id).notesMarkdown).toBe('My handwritten notes'); expect(store.get(l.id).draft?.sections[0].heading).toBe('Cells');
});
test('restart recovery never marks incomplete work ready', () => {
  const l = store.create({ title: 'Interrupted' }); store.update(l.id, { status: 'generating', notesMarkdown: 'preserved' }); store.recover();
  expect(store.get(l.id)).toMatchObject({ status: 'interrupted', notesMarkdown: 'preserved' });
});
test('a quota failure during evidence review resumes the saved candidate without generating it again', async () => {
  const l = store.create({ title: 'Evidence review retry' }); let generations = 0, reviews = 0;
  store.update(l.id, { audioFile: 'original.wav', segments: [{ id: 's1', startSeconds: 0, endSeconds: 1, text: 'A cell is a unit of life.' }], transcriptVersion: 1 });
  const j = new Jobs(store, settings, { ...fixtureProvider, async notes(s, signal) { generations++; return fixtureProvider.notes(s, signal); }, async review(n) { if (++reviews === 1) throw new QuotaError(Date.now() + 60000); return n; } });
  await j.start(l.id, 'local', true); await wait(j);
  expect(store.get(l.id).status).toBe('waiting'); expect(store.get(l.id).sectionCandidates['0']).toBeDefined();
  await j.start(l.id, 'local', true); await wait(j);
  expect(store.get(l.id).status).toBe('ready'); expect(generations).toBe(1); expect(reviews).toBe(2);
});
test('editing a transcript while AI is running cannot restore stale section caches', async () => {
  const l = store.create({ title: 'Concurrent transcript correction' });
  store.update(l.id, { audioFile: 'original.wav', segments: [{ id: 's1', startSeconds: 0, endSeconds: 1, text: 'Original text' }], transcriptVersion: 1 });
  let release!: () => void; const pending = new Promise<void>(r => { release = r; });
  const j = new Jobs(store, settings, { ...fixtureProvider, async notes(s, signal) { await pending; return fixtureProvider.notes(s, signal); } });
  await j.start(l.id, 'local', true);
  store.update(l.id, { segments: [{ id: 's1', startSeconds: 0, endSeconds: 1, text: 'Corrected text' }], transcriptVersion: 2, sectionNotes: {}, sectionCandidates: {} });
  release(); await wait(j);
  expect(store.get(l.id).status).toBe('failed'); expect(store.get(l.id).sectionNotes).toEqual({}); expect(store.get(l.id).sectionCandidates).toEqual({});
});
test('a storage failure while queuing does not strand the processing lock or remove saved audio', async () => {
  const l = store.create({ title: 'Queue storage failure' }); const file = path.join(store.folder(l.id), 'original.wav');
  await runProcess(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=duration=1', file]); store.update(l.id, { audioFile: 'original.wav', duration: 1 });
  const before = readFileSync(file); const save = vi.spyOn(store, 'update').mockImplementationOnce(() => { throw new Error('Simulated disk failure'); });
  const j = new Jobs(store, settings, fixtureProvider); await expect(j.start(l.id, 'local')).rejects.toThrow('disk failure');
  expect(j.active.size).toBe(0); expect(readFileSync(file)).toEqual(before); save.mockRestore();
});
