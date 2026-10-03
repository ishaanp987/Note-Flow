import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { prepareAudio, runProcess, ffmpeg, validateAudio } from '../../src/server/audio';
let dir: string;
beforeAll(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'lecture-audio-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));
test('rejects a non-audio file without pretending it is ready', async () => {
  const p = path.join(dir, 'bad.wav'); writeFileSync(p, 'this is not audio');
  await expect(validateAudio(p)).rejects.toThrow();
});
test('prepares independently playable chunks with original offsets', async () => {
  const p = path.join(dir, 'valid.wav');
  await runProcess(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', p]);
  expect((await validateAudio(p)).duration).toBeCloseTo(4, 1);
  const chunks = await prepareAudio(p, dir, 4, 2);
  expect(chunks.map(c => c.offset)).toEqual([0, 2]);
  expect((await validateAudio(chunks[1].file)).duration).toBeCloseTo(2, 1);
});
test.each(['mp3', 'm4a', 'webm'])('decodes supported %s audio without losing duration', async ext => {
  const file = path.join(dir, `supported.${ext}`);
  await runProcess(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', file]);
  expect((await validateAudio(file)).duration).toBeCloseTo(3, 0);
  const chunks = await prepareAudio(file, dir, 3, 2);
  expect(chunks).toHaveLength(2); expect((await validateAudio(chunks[1].file)).duration).toBeCloseTo(1, 0);
});
