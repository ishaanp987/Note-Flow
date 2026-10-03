import { readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import { Settings } from '../settings';
import { runProcess } from '../audio';
import { notesInstruction, reviewInstruction, validateNotes, type Provider } from './contracts';
import { z } from 'zod';
export function localProvider(settings: Settings): Provider {
  return {
    async review(notes, segments, signal) {
      const res = await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: settings.config.localModel, system: reviewInstruction, prompt: JSON.stringify({ transcript: segments.map(s => ({ id: s.id, text: s.text })), draft: notes }), stream: false, think: false, format: 'json', options: { temperature: 0, num_ctx: 8192, num_predict: 2500 } }), signal: AbortSignal.any([signal, AbortSignal.timeout(900000)]) });
      if (!res.ok) throw new Error('The local evidence review could not finish. Your generated section draft is saved for retry.');
      const result = z.object({ response: z.string() }).parse(await res.json()); return validateNotes(JSON.parse(result.response), segments.map(s => s.id));
    },
    async transcribe(file, vocabulary, signal) {
      const out = `${file}.transcript`;
      await runProcess(settings.config.whisperPath, ['-m', settings.config.whisperModel, '-f', file, '-l', 'en', '-t', String(Math.min(6, os.cpus().length)), '-oj', '-of', out, ...(vocabulary ? ['--prompt', vocabulary.slice(0, 800)] : [])], signal, 3600000);
      try {
        const output = z.object({ transcription: z.array(z.object({ offsets: z.object({ from: z.number(), to: z.number() }), text: z.string() })) }).parse(JSON.parse(await readFile(`${out}.json`, 'utf8')));
        return output.transcription.map(s => ({ start: s.offsets.from / 1000, end: s.offsets.to / 1000, text: s.text }));
      } finally { await unlink(`${out}.json`).catch(() => {}); }
    },
    async notes(segments, signal) {
      if (/cloud/i.test(settings.config.localModel)) throw new Error('Local mode requires a downloaded local model.');
      const res = await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: settings.config.localModel, system: notesInstruction, prompt: JSON.stringify(segments.map(s => ({ id: s.id, text: s.text }))), stream: false, think: false, format: 'json', options: { temperature: 0.2, num_ctx: 8192, num_predict: 2500 } }), signal: AbortSignal.any([signal, AbortSignal.timeout(900000)]) });
      if (!res.ok) throw new Error('The local note model could not run. Check Ollama and the downloaded model in Settings.');
      const result = z.object({ response: z.string() }).parse(await res.json()); return validateNotes(JSON.parse(result.response), segments.map(s => s.id));
    }
  };
}
