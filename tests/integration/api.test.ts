import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { Store } from '../../src/server/storage';
import { createApp } from '../../src/server/app';
import { runProcess, ffmpeg } from '../../src/server/audio';
import type { Lecture } from '../../src/shared/lecture';
let server: Server, store: Store, dir: string, base: string, token: string;
beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'lecture-api-')); store = new Store(dir);
  server = createApp(store).listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error(); base = `http://127.0.0.1:${address.port}/api`;
  token = (await (await fetch(`${base}/bootstrap`)).json()).token;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); rmSync(dir, { recursive: true, force: true }); });
async function request(route: string, method = 'GET', body?: unknown) { return fetch(base + route, { method, headers: { 'Content-Type': 'application/json', 'X-Lecture-Token': token }, body: body === undefined ? undefined : JSON.stringify(body) }); }
test('refuses cross-origin changes and mutation without the local token', async () => {
  expect((await fetch(base + '/lectures', { method: 'POST', headers: { Origin: 'https://example.com' } })).status).toBe(403);
  expect((await fetch(base + '/lectures', { method: 'POST' })).status).toBe(403);
});
test('saves uploads, serves byte ranges, and scopes deletion to one lecture', async () => {
  const l = await (await request('/lectures', 'POST', { title: 'Test lecture' })).json() as Lecture;
  const keep = await (await request('/lectures', 'POST', { title: 'Keep me' })).json() as Lecture;
  const wav = path.join(dir, 'test.wav'); await runProcess(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', wav]);
  const upload = await fetch(`${base}/lectures/${l.id}/audio`, { method: 'PUT', headers: { 'X-Lecture-Token': token, 'X-Audio-Name': 'test.wav' }, body: readFileSync(wav) });
  expect(upload.status).toBe(200); expect((await upload.json()).duration).toBeCloseTo(2, 1);
  const audio = await fetch(`${base}/lectures/${l.id}/audio`, { headers: { Range: 'bytes=0-99' } }); expect(audio.status).toBe(206); expect((await audio.arrayBuffer()).byteLength).toBe(100);
  expect((await fetch(`${base}/lectures/${l.id}/audio`, { headers: { Range: 'bytes=999999999-' } })).status).toBe(416);
  expect((await request(`/lectures/${l.id}`, 'DELETE')).status).toBe(200); expect((await request(`/lectures/${keep.id}`)).status).toBe(200);
});
test('saving transcript changes marks notes stale and rejects stale edit versions', async () => {
  const l = store.create({ title: 'Edit test' }); store.update(l.id, { segments: [{ id: 's1', startSeconds: 0, endSeconds: 2, text: 'old' }], transcriptVersion: 1, notesVersion: 1 });
  const response = await request(`/lectures/${l.id}/transcript`, 'PATCH', { version: 1, segments: [{ id: 's1', text: 'corrected' }] }); expect(response.status).toBe(200);
  expect(store.get(l.id).transcriptVersion).toBe(2); expect(store.get(l.id).notesVersion).toBe(1);
  expect((await request(`/lectures/${l.id}/transcript`, 'PATCH', { version: 1, segments: [{ id: 's1', text: 'stale' }] })).status).toBe(400);
});
test('never returns the cloud secret and keeps it out of persistent settings', async () => {
  const settings = await (await request('/settings')).json();
  expect((await request('/settings', 'PUT', { ...settings, key: 'gsk_test_only_not_a_real_key', freeConfirmed: false })).status).toBe(400);
  const saved = await request('/settings', 'PUT', { ...settings, key: 'gsk_test_only_not_a_real_key', freeConfirmed: true }); expect(await saved.text()).not.toContain('gsk_test');
  expect(readFileSync(path.join(dir, 'settings.json'), 'utf8')).not.toContain('gsk_test');
});
test('recording retries are idempotent and interrupted chunks remain recoverable', async () => {
  const l = store.create({ title: 'Recover recording' }); const file = path.join(dir, 'capture.webm');
  await runProcess(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', file]);
  await request(`/lectures/${l.id}/recording`, 'POST', { mime: 'audio/webm;codecs=opus' });
  const bytes = readFileSync(file);
  async function chunk(index: number, content: Buffer) { return fetch(`${base}/lectures/${l.id}/chunks/${index}`, { method: 'PUT', headers: { 'X-Lecture-Token': token }, body: new Uint8Array(content) }); }
  expect((await chunk(0, bytes)).status).toBe(200); expect((await chunk(0, bytes)).status).toBe(200); expect(store.get(l.id).recordingChunks).toBe(1);
  expect((await chunk(0, Buffer.from('different'))).status).toBe(400); expect((await chunk(2, bytes)).status).toBe(400);
  expect((await request(`/lectures/${l.id}`, 'DELETE')).status).toBe(400);
  store.recover(); expect(store.get(l.id).status).toBe('interrupted');
  expect((await request(`/lectures/${l.id}/finish-recording`, 'POST')).status).toBe(200); expect(store.get(l.id).duration).toBeCloseTo(2, 1);
});
