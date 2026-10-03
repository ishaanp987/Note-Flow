import { Router } from 'express';
import { createReadStream } from 'node:fs';
import { rename, unlink, stat } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Store } from './storage';
import { receiveAudio, validateAudio, joinRecording, runProcess, ffmpeg } from './audio';
import { MAX_BYTES } from '../shared/lecture';
export const mediaLocks = new Set<string>();
export function mediaRoutes(store: Store) {
  const router = Router();
  router.put('/:id/audio', async (req, res) => {
    const l = store.get(req.params.id); if (l.audioFile || l.recordingChunks || mediaLocks.has(l.id)) throw new Error('This lecture already has audio. Create a new lecture for a different recording.');
    const name = decodeURIComponent(String(req.headers['x-audio-name'] || 'audio.webm')); const ext = path.extname(name).toLowerCase();
    if (!['.mp3', '.m4a', '.wav', '.webm'].includes(ext)) throw new Error('Choose MP3, M4A, WAV, or WebM audio.');
    if (Number(req.headers['content-length']) > MAX_BYTES) { res.status(413).json({ error: 'Audio files must be at most 2 GiB.' }); return; }
    mediaLocks.add(l.id); const temp = path.join(store.folder(l.id), `upload-${randomUUID()}${ext}`);
    try { await receiveAudio(req, temp); const { duration } = await validateAudio(temp); const filename = `original${ext}`; await rename(temp, path.join(store.folder(l.id), filename)); res.json(store.update(l.id, { audioFile: filename, audioName: path.basename(name), duration, status: 'audio', message: '' })); }
    finally { mediaLocks.delete(l.id); await unlink(temp).catch(() => {}); }
  });
  router.post('/:id/recording', (req, res) => {
    const l = store.get(req.params.id); if (l.audioFile || l.recordingChunks) throw new Error('Create a new lecture to record again.');
    const mime = String(req.body.mime); if (!['audio/webm', 'audio/mp4', 'audio/ogg'].some(v => mime.startsWith(v))) throw new Error('Recording format is not supported by this browser.');
    res.json(store.update(l.id, { status: 'recording', recordingMime: mime, message: '' }));
  });
  router.put('/:id/chunks/:index', async (req, res) => {
    const l = store.get(req.params.id); const index = Number(req.params.index);
    if (l.audioFile || !l.recordingMime || !Number.isSafeInteger(index) || index < 0 || index > l.recordingChunks || mediaLocks.has(l.id)) throw new Error('Recording chunk is out of sequence. Try saving it again.');
    mediaLocks.add(l.id); const temp = path.join(store.folder(l.id), `incoming-${randomUUID()}`); const target = path.join(store.folder(l.id), `record-${index}.part`);
    try {
      await receiveAudio(req, temp, 16 * 1024 ** 2); const size = (await stat(temp)).size;
      if (index < l.recordingChunks) {
        async function hash(file: string) { const h = createHash('sha256'); for await (const b of createReadStream(file)) h.update(b); return h.digest('hex'); }
        if (await hash(temp) !== await hash(target)) throw new Error('Saved recording chunk differs from the retried chunk.');
      } else {
        if (l.recordingBytes + size > MAX_BYTES) throw new Error('The recording has reached the 2 GiB size limit. Stop recording now.');
        await rename(temp, target); store.update(l.id, { recordingChunks: index + 1, recordingBytes: l.recordingBytes + size });
      }
      res.json({ saved: index });
    } finally { mediaLocks.delete(l.id); await unlink(temp).catch(() => {}); }
  });
  router.post('/:id/finish-recording', async (req, res) => {
    const l = store.get(req.params.id); if (!l.recordingChunks || l.audioFile || mediaLocks.has(l.id)) throw new Error('No saved recording is ready to finalize.');
    mediaLocks.add(l.id); const dir = store.folder(l.id); const raw = path.join(dir, `joined-${randomUUID()}.webm`); const filename = 'original.m4a';
    try {
      await joinRecording(Array.from({ length: l.recordingChunks }, (_, i) => path.join(dir, `record-${i}.part`)), raw);
      // Remuxing/encoding gives interrupted browser recordings a seekable container.
      await runProcess(ffmpeg, ['-y', '-v', 'error', '-i', raw, '-t', '7200', '-map', '0:a:0', '-c:a', 'aac', '-b:a', '96k', path.join(dir, filename)]);
      const { duration } = await validateAudio(path.join(dir, filename));
      res.json(store.update(l.id, { audioFile: filename, audioName: `${l.title}.m4a`, duration, status: 'audio', message: 'Recording saved.' }));
    } finally { mediaLocks.delete(l.id); await unlink(raw).catch(() => {}); }
  });
  router.get('/:id/audio', async (req, res) => {
    const l = store.get(req.params.id); if (!l.audioFile) { res.status(404).json({ error: 'This lecture has no saved audio yet.' }); return; }
    const file = path.join(store.folder(l.id), l.audioFile); const size = (await stat(file)).size;
    const mime: Record<string, string> = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.webm': 'audio/webm' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.setHeader('Accept-Ranges', 'bytes');
    if (req.query.download) res.attachment(path.basename(l.audioName).replace(/[\r\n]/g, ''));
    let start = 0, end = size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match) { res.status(416).set('Content-Range', `bytes */${size}`).end(); return; }
      if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
      else if (match[2]) start = Math.max(0, size - Number(match[2]));
      else { res.status(416).end(); return; }
      if (start >= size || start < 0 || end < start) { res.status(416).set('Content-Range', `bytes */${size}`).end(); return; }
      res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.set('Content-Length', String(end - start + 1));
    try { await pipeline(createReadStream(file, { start, end }), res); }
    catch (error) { if (!req.destroyed && !res.destroyed) throw error; }
  });
  return router;
}
