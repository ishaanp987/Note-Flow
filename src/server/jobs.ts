import path from 'node:path';
import { Store } from './storage';
import { Settings } from './settings';
import { prepareAudio } from './audio';
import { busy, markdown, type Engine, type Notes } from '../shared/lecture';
import { groqProvider } from './providers/groq';
import { localProvider } from './providers/local';
import { groupTranscript, mapSegments, QuotaError, type Provider } from './providers/contracts';
export class Jobs {
  active = new Map<string, AbortController>();
  constructor(private store: Store, private settings: Settings, private override?: Provider) {}
  async start(id: string, engine: Engine, notesOnly = false) {
    const l = this.store.get(id);
    if (this.active.size) throw new Error('A lecture is already processing. Wait for it to finish or stop it first.');
    if (!l.audioFile) throw new Error('Save lecture audio before starting processing.');
    if (engine === 'groq' && l.retryAt && l.retryAt > Date.now()) throw new Error('The free cloud quota is still waiting to reset. Try Local or resume later.');
    if (!this.override) {
      const ready = await this.settings.readiness();
      if (engine === 'groq' && !ready.cloud) throw new Error('Set up a Groq Free-plan key in Settings, or use Local.');
      if (engine === 'local' && (!ready.whisper || !ready.ollama)) throw new Error('Local processing needs whisper.cpp, its speech model, and the selected Ollama model. Check Settings.');
    }
    if (this.active.size) throw new Error('Another lecture just started processing. Try again when it finishes.');
    const controller = new AbortController(); this.active.set(id, controller);
    const resume = ['failed', 'waiting', 'interrupted'].includes(l.status);
    try { this.store.update(id, { status: 'queued', engine, message: 'Queued for processing.', retryAt: null, ...(notesOnly && !resume ? { sectionNotes: {}, sectionCandidates: {} } : {}) }); }
    catch (error) { this.active.delete(id); throw error; }
    void this.run(id, engine, controller, notesOnly); return this.store.get(id);
  }
  stop(id: string) { this.active.get(id)?.abort(); }
  private async run(id: string, engine: Engine, controller: AbortController, notesOnly: boolean) {
    const signal = controller.signal;
    try {
      const provider = this.override || (engine === 'groq' ? groqProvider(this.settings) : localProvider(this.settings));
      let lecture = this.store.get(id);
      if (!notesOnly && !lecture.segments.length) {
        this.store.update(id, { status: 'preparing', message: 'Preparing audio chunks. Original audio is saved.', progress: null });
        const chunks = await prepareAudio(path.join(this.store.folder(id), lecture.audioFile), this.store.folder(id), lecture.duration, 600, signal);
        for (const c of chunks) {
          if (signal.aborted) throw new Error('Processing stopped.');
          const current = this.store.get(id); const existing = current.chunkResults;
          if (!existing[String(c.index)]) {
            this.store.update(id, { status: 'transcribing', message: `Transcribing part ${c.index + 1} of ${chunks.length}.`, progress: { done: Object.keys(existing).length, total: chunks.length } });
            const result = await provider.transcribe(c.file, lecture.vocabulary, signal);
            existing[String(c.index)] = mapSegments(result, c.offset, Math.min(600, lecture.duration - c.offset), c.index);
            this.store.update(id, { chunkResults: existing });
          }
        }
        const parts = this.store.get(id).chunkResults;
        const segments = Object.keys(parts).sort((a, b) => Number(a) - Number(b)).flatMap(k => parts[k]);
        if (!segments.length) throw new Error('No intelligible speech was found. Listen to the saved audio and try a clearer recording.');
        lecture = this.store.update(id, { segments, transcriptVersion: this.store.get(id).transcriptVersion + 1 });
      }
      if (!lecture.segments.length) throw new Error('A transcript is needed to generate study notes.');
      const version = lecture.transcriptVersion; const groups = groupTranscript(lecture.segments);
      const checkRevision = () => {
        if (signal.aborted) throw new Error('Processing stopped.');
        if (this.store.get(id).transcriptVersion !== version) throw new Error('Transcript changed during note generation. Saved notes are preserved; generate again from the edited transcript.');
      };
      for (let i = 0; i < groups.length; i++) {
        checkRevision();
        const saved = this.store.get(id).sectionNotes;
        if (!saved[String(i)]) {
          this.store.update(id, { status: 'generating', message: `Writing detailed notes for section ${i + 1} of ${groups.length}.`, progress: { done: Object.keys(saved).length, total: groups.length } });
          const candidates = this.store.get(id).sectionCandidates || {};
          if (!candidates[String(i)]) {
            const candidate = await provider.notes(groups[i], signal); checkRevision();
            candidates[String(i)] = candidate; this.store.update(id, { sectionCandidates: candidates });
          }
          this.store.update(id, { message: `Checking section ${i + 1} of ${groups.length} against the transcript.` });
          saved[String(i)] = provider.review ? await provider.review(candidates[String(i)], groups[i], signal) : candidates[String(i)];
          checkRevision();
          this.store.update(id, { sectionNotes: saved });
        }
      }
      if (signal.aborted) throw new Error('Processing stopped.');
      const current = this.store.get(id); if (current.transcriptVersion !== version) throw new Error('Transcript changed. Generate notes again from the saved edits.');
      const parts = Object.keys(current.sectionNotes).sort((a, b) => Number(a) - Number(b)).map(k => current.sectionNotes[k]);
      const notes: Notes = { summary: parts.map(p => p.summary).join('\n\n'), sections: parts.flatMap(p => p.sections) };
      this.store.update(id, current.notes ? { draft: notes, draftVersion: version, status: 'ready', progress: null, message: 'A new notes draft is ready. Review it before replacing your saved notes.' } : { notes, notesMarkdown: markdown(notes), notesVersion: version, notesRevision: (current.notesRevision || 0) + 1, notesEdited: false, status: 'ready', progress: null, message: 'Transcript and notes are ready. Review AI-generated notes against the original audio.' });
    } catch (e) {
      const err = e as Error;
      try { this.store.update(id, { status: e instanceof QuotaError ? 'waiting' : signal.aborted ? 'interrupted' : 'failed', retryAt: e instanceof QuotaError ? e.retryAt : null, progress: null, message: err.name === 'ZodError' || err instanceof SyntaxError ? 'The AI returned an invalid response. Your audio and completed work are saved. Try again.' : err.message.replace(/gsk_[\w-]+/g, '[redacted]') }); } catch { /* A deleted lecture has no remaining job document. */ }
    } finally { this.active.delete(id); }
  }
  isActive(id: string) { return this.active.has(id) || busy(this.store.get(id).status); }
}
