import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runProcess, ffmpeg, validateAudio, prepareAudio, byteLimiter } from '../../src/server/audio';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { MAX_BYTES } from '../../src/shared/lecture';
let dir: string;
beforeAll(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'lecture-long-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));
test('streams a two-hour fixture into twelve independently decodable chunks', async () => {
  const original = path.join(dir, 'two-hours.wav');
  await runProcess(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '7200', '-c:a', 'pcm_s16le', original]);
  expect((await validateAudio(original)).duration).toBe(7200);
  const chunks = await prepareAudio(original, dir, 7200);
  expect(chunks).toHaveLength(12); expect(chunks.map(c => c.offset)).toEqual(Array.from({ length: 12 }, (_, i) => i * 600));
  for (const index of [0, 6, 11]) {
    const c = chunks[index]; expect((await stat(c.file)).size).toBeLessThan(25_000_000);
    expect((await validateAudio(c.file)).duration).toBe(600);
  }
}, 120000);
test('streamed byte limiter rejects over-limit data without buffering a huge file', async () => {
  const source = Readable.from([Buffer.alloc(10), Buffer.alloc(11)]);
  await expect(pipeline(source, byteLimiter(20), new Writable({ write(_b, _e, cb) { cb(); } }))).rejects.toThrow('file size');
});
test('accepts exactly 2 GiB of streamed bytes and rejects the very next byte', async () => {
  const block = Buffer.alloc(16 * 1024 ** 2); const sink = () => new Writable({ write(_b, _e, cb) { cb(); } });
  function* bytes(extra: boolean) { for (let i = 0; i < MAX_BYTES / block.length; i++) yield block; if (extra) yield Buffer.alloc(1); }
  await expect(pipeline(Readable.from(bytes(false)), byteLimiter(MAX_BYTES), sink())).resolves.toBeUndefined();
  await expect(pipeline(Readable.from(bytes(true)), byteLimiter(MAX_BYTES), sink())).rejects.toThrow('file size');
});
