import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { Settings } from '../settings';
import { notesInstruction, reviewInstruction, validateNotes, QuotaError, type Provider } from './contracts';
export function groqProvider(settings: Settings): Provider {
  async function call(endpoint: string, body: BodyInit, signal: AbortSignal, json = false) {
    if (!settings.key || !settings.freeConfirmed) throw new Error('Configure a confirmed Groq Free-plan account in Settings, or choose Local.');
    const res = await fetch(`https://api.groq.com/openai/v1/${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${settings.key}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }, body, signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]) });
    if (res.status === 429) {
      const retry = res.headers.get('retry-after'); const seconds = Number(retry);
      const date = retry ? Date.parse(retry) : NaN;
      throw new QuotaError(Number.isFinite(seconds) && seconds >= 0 && retry !== null ? Date.now() + seconds * 1000 : Number.isFinite(date) ? Math.max(Date.now(), date) : Date.now() + 60000);
    }
    if (!res.ok) throw new Error(res.status === 401 ? 'The Groq API key was rejected. Update it in Settings.' : `Groq could not process this request (${res.status}). Your source audio is saved. Try again later or choose Local.`);
    return res.json();
  }
  return {
    async review(notes, segments, signal) {
      const output = await call('chat/completions', JSON.stringify({ model: 'openai/gpt-oss-20b', temperature: 0, max_completion_tokens: 3000, reasoning_effort: 'low', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: reviewInstruction }, { role: 'user', content: JSON.stringify({ transcript: segments.map(s => ({ id: s.id, text: s.text })), draft: notes }) }] }), signal, true);
      const result = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })) }).parse(output);
      return validateNotes(JSON.parse(result.choices[0].message.content), segments.map(s => s.id));
    },
    async transcribe(file, vocabulary, signal) {
      const form = new FormData(); form.set('file', new Blob([await readFile(file)]), 'lecture.wav'); form.set('model', 'whisper-large-v3-turbo'); form.set('response_format', 'verbose_json'); form.set('timestamp_granularities[]', 'segment'); form.set('language', 'en'); if (vocabulary) form.set('prompt', vocabulary.slice(0, 800));
      const output = await call('audio/transcriptions', form, signal);
      return z.object({ segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })) }).parse(output).segments;
    },
    async notes(segments, signal) {
      const output = await call('chat/completions', JSON.stringify({ model: 'openai/gpt-oss-20b', temperature: 0.2, max_completion_tokens: 3000, reasoning_effort: 'low', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: notesInstruction }, { role: 'user', content: JSON.stringify(segments.map(s => ({ id: s.id, text: s.text }))) }] }), signal, true);
      const result = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })) }).parse(output);
      return validateNotes(JSON.parse(result.choices[0].message.content), segments.map(s => s.id));
    }
  };
}
