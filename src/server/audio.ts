import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import path from 'node:path';
import { MAX_BYTES, MAX_SECONDS } from '../shared/lecture';

export const ffmpeg = process.env.FFMPEG_PATH || path.resolve('node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
export const ffprobe = process.env.FFPROBE_PATH || path.resolve('node_modules/@ffprobe-installer/win32-x64/ffprobe.exe');
export function runProcess(binary: string, args: string[], signal?: AbortSignal, timeout = 300000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, shell: false, signal });
    let stdout = '', stderr = ''; const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on('data', b => { if (stdout.length < 4_000_000) stdout += b.toString(); });
    child.stderr.on('data', b => { stderr = (stderr + b.toString()).slice(-4000); });
    child.on('error', () => { clearTimeout(timer); reject(new Error(signal?.aborted ? 'Processing cancelled.' : 'A required local audio tool could not start. Check Settings.')); });
    child.on('close', code => { clearTimeout(timer); if (code === 0) resolve(stdout); else reject(new Error(signal?.aborted ? 'Processing cancelled.' : `Audio processing failed. ${stderr.slice(-500)}`)); });
  });
}
export function byteLimiter(limit: number) {
  let bytes = 0;
  return new Transform({ transform(chunk: Buffer, _encoding, callback) { bytes += chunk.length; callback(bytes > limit ? new Error('Audio exceeds the permitted file size.') : null, chunk); } });
}
export async function receiveAudio(source: NodeJS.ReadableStream, target: string, limit = MAX_BYTES) {
  try { await pipeline(source, byteLimiter(limit), createWriteStream(target, { flags: 'wx' })); }
  catch (err) { await unlink(target).catch(() => {}); throw err; }
}
export async function validateAudio(file: string, signal?: AbortSignal) {
  const bytes = (await stat(file)).size;
  if (!bytes || bytes > MAX_BYTES) throw new Error('Choose a non-empty audio file up to 2 GiB.');
  const info = JSON.parse(await runProcess(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], signal)) as { format?: { duration?: string }; streams?: { codec_type: string; duration?: string }[] };
  const audio = info.streams?.find(s => s.codec_type === 'audio');
  if (!audio) throw new Error('This file does not contain a readable audio track.');
  let duration = Number(info.format?.duration || audio.duration);
  // Interrupted WebM recordings can lack container duration; normalization supplies it.
  if (!Number.isFinite(duration)) throw new Error('Audio duration could not be read. Try recovering a recording or uploading another file.');
  duration = Math.max(0, duration);
  if (duration <= 0 || duration > MAX_SECONDS + 0.1) throw new Error('Lectures must contain audio and be no longer than 2 hours.');
  await runProcess(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:a:0', '-f', 'null', '-'], signal);
  return { duration, bytes };
}
export type AudioChunk = { file: string; offset: number; index: number };
export async function prepareAudio(source: string, dir: string, duration: number, chunkSeconds = 600, signal?: AbortSignal): Promise<AudioChunk[]> {
  const chunks: AudioChunk[] = [];
  for (let offset = 0, index = 0; offset < duration - 0.01; offset += chunkSeconds, index++) {
    const file = path.join(dir, `processed-${index}.wav`);
    // 10 minutes of 16 kHz mono PCM is 19.2 MB, safely below the free cloud limit.
    await runProcess(ffmpeg, ['-y', '-v', 'error', '-ss', String(offset), '-i', source, '-t', String(Math.min(chunkSeconds, duration - offset)), '-map', '0:a:0', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', file], signal);
    chunks.push({ file, offset, index });
  }
  return chunks;
}
export async function joinRecording(files: string[], target: string) {
  const output = createWriteStream(target, { flags: 'wx' });
  try {
    for (const file of files) await pipeline(createReadStream(file), output, { end: false });
    await new Promise<void>((resolve, reject) => { output.once('error', reject); output.end(resolve); });
  } catch (e) { output.destroy(); await unlink(target).catch(() => {}); throw e; }
}
