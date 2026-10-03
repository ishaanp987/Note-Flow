import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { lectureInput, type Lecture } from '../shared/lecture';

export class Store {
  readonly db: DatabaseSync;
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(path.join(dir, 'lectures.sqlite'));
    this.db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS lectures (id TEXT PRIMARY KEY, document TEXT NOT NULL);');
  }
  create(input: unknown): Lecture {
    const meta = lectureInput.parse(input);
    const doc: Lecture = { ...meta, id: randomUUID(), createdAt: new Date().toISOString(), status: 'empty', message: '', audioFile: '', audioName: '', duration: 0, segments: [], transcriptVersion: 0, notesVersion: 0, notes: null, notesMarkdown: '', notesEdited: false, draft: null, draftVersion: 0, notesRevision: 0, chunkResults: {}, sectionNotes: {}, sectionCandidates: {}, engine: 'groq', recordingMime: '', recordingChunks: 0, recordingBytes: 0, progress: null, retryAt: null };
    this.db.prepare('INSERT INTO lectures VALUES (?, ?)').run(doc.id, JSON.stringify(doc)); return doc;
  }
  get(id: string): Lecture {
    const row = this.db.prepare('SELECT document FROM lectures WHERE id = ?').get(id);
    if (!row) throw new Error('Lecture not found.');
    return JSON.parse(String(row.document)) as Lecture;
  }
  list(): Lecture[] {
    return this.db.prepare('SELECT document FROM lectures ORDER BY rowid DESC').all().map(row => JSON.parse(String(row.document)) as Lecture);
  }
  update(id: string, patch: Partial<Lecture>): Lecture {
    const previous = this.get(id); const next = { ...previous, ...patch, id: previous.id };
    this.db.prepare('UPDATE lectures SET document = ? WHERE id = ?').run(JSON.stringify(next), id); return next;
  }
  delete(id: string) { this.get(id); this.db.prepare('DELETE FROM lectures WHERE id = ?').run(id); }
  folder(id: string) { this.get(id); const p = path.join(this.dir, id); mkdirSync(p, { recursive: true }); return p; }
  close() { this.db.close(); }
  recover() {
    for (const l of this.list()) {
      if (['queued', 'preparing', 'transcribing', 'generating'].includes(l.status)) this.update(l.id, { status: 'interrupted', message: 'Processing was interrupted. Your audio and completed work are saved. Choose Resume processing.', progress: null });
      if (l.status === 'recording') this.update(l.id, { status: 'interrupted', message: 'Recording was interrupted. Saved audio chunks can be recovered; the final unsaved seconds may be missing.' });
    }
  }
}
