import { z } from 'zod';
export const MAX_SECONDS = 7200;
export const MAX_BYTES = 2 * 1024 ** 3;
export const lectureInput = z.object({ title: z.string().trim().min(1, 'Give your lecture a title.').max(200), course: z.string().trim().max(100).default(''), vocabulary: z.string().max(1000).default('') });
export const segmentSchema = z.object({ id: z.string(), startSeconds: z.number().nonnegative(), endSeconds: z.number().nonnegative(), text: z.string().max(50000) });
export type Segment = z.infer<typeof segmentSchema>;
export const noteSchema = z.object({ summary: z.string().max(20000), sections: z.array(z.object({ heading: z.string().max(500), body: z.string().max(30000), sourceSegmentIds: z.array(z.string()).min(1) })).min(1).max(200) });
export type Notes = z.infer<typeof noteSchema>;
export type Engine = 'groq' | 'local';
export type Status = 'empty' | 'recording' | 'audio' | 'queued' | 'preparing' | 'transcribing' | 'generating' | 'waiting' | 'ready' | 'failed' | 'interrupted';
export interface Lecture {
  id: string; title: string; course: string; vocabulary: string; createdAt: string;
  status: Status; message: string; audioFile: string; audioName: string; duration: number;
  segments: Segment[]; transcriptVersion: number; notesVersion: number;
  notes: Notes | null; notesMarkdown: string; notesEdited: boolean; draft: Notes | null; draftVersion: number; notesRevision: number;
  chunkResults: Record<string, Segment[]>; sectionNotes: Record<string, Notes>; sectionCandidates: Record<string, Notes>;
  engine: Engine; recordingMime: string; recordingChunks: number; recordingBytes: number;
  progress: { done: number; total: number } | null; retryAt: number | null;
}
export const busy = (status: Status) => ['queued', 'preparing', 'transcribing', 'generating'].includes(status);
export function markdown(notes: Notes): string {
  return `## Summary\n\n${notes.summary}\n\n${notes.sections.map(s => `## ${s.heading}\n\n${s.body}`).join('\n\n')}`;
}
export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
