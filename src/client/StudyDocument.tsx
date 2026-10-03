import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { api } from './api';
import { formatTime, type Lecture } from '../shared/lecture';
export function StudyDocument({ lecture: l, tab, onRefresh, onEditing, seek }: { lecture: Lecture | null; tab: string; onRefresh: () => Promise<void>; onEditing: (value: boolean) => void; seek: (seconds: number) => void }) {
  const [editing, setEditing] = useState(false); const [noteText, setNoteText] = useState(''); const [texts, setTexts] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => {
    onEditing(editing);
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    if (editing) window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); onEditing(false); };
  }, [editing, onEditing]);
  async function save() {
    if (!l) return; setSaving(true); setError('');
    try { await api(`/lectures/${l.id}/${tab === 'notes' ? 'notes' : 'transcript'}`, 'PATCH', tab === 'notes' ? { markdown: noteText, revision: version } : { version, segments: l.segments.map(s => ({ id: s.id, text: texts[s.id] ?? s.text })) }); await onRefresh(); setEditing(false); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  if (!l || (tab === 'notes' ? !l.notes : !l.segments.length)) return <div className="empty-document"><FileText size={58} strokeWidth={1.4}/><h3>{tab === 'notes' ? 'Your notes, organized' : 'The lecture, word by word'}</h3><p>{tab === 'notes' ? 'Detailed explanations, definitions, and examples will appear here after processing.' : 'Your timestamped transcript will appear here after processing.'}</p></div>;
  return <section className="study-document" role="tabpanel" aria-label={tab === 'notes' ? 'Study notes' : 'Transcript'}>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="document-toolbar"><span>{tab === 'notes' ? l.notesEdited ? 'Your edited notes' : 'AI-generated · Check against the lecture' : `${l.segments.length} timestamped segments`}</span>{editing ? <div className="actions"><button onClick={() => setEditing(false)} disabled={saving}>Cancel</button><button className="primary" onClick={() => void save()} disabled={saving}>Save edits</button></div> : <button onClick={() => { setEditing(true); setError(''); if (tab === 'notes') { setNoteText(l.notesMarkdown); setVersion(l.notesRevision || 0); } else { setTexts(Object.fromEntries(l.segments.map(s => [s.id, s.text]))); setVersion(l.transcriptVersion); } }}>Edit {tab === 'notes' ? 'notes' : 'transcript'}</button>}</div>
    {tab === 'transcript' ? <div className="transcript">{l.segments.map(s => <div className="transcript-row" key={s.id}><button className="timestamp" onClick={() => seek(s.startSeconds)}>{formatTime(s.startSeconds)}</button>{editing ? <textarea aria-label={`Transcript at ${formatTime(s.startSeconds)}`} value={texts[s.id] ?? s.text} onChange={e => setTexts({ ...texts, [s.id]: e.target.value })}/> : <p>{s.text}</p>}</div>)}</div> : editing ? <textarea className="notes-editor" aria-label="Edit study notes" value={noteText} onChange={e => setNoteText(e.target.value)}/> : <>
      {l.notesVersion !== l.transcriptVersion && <p className="warning">The transcript has changed since these notes were generated. Regenerate to use the saved corrections.</p>}
      {l.notesEdited ? <MarkdownText text={l.notesMarkdown}/> : <><h2>Summary</h2><p className="note-body">{l.notes!.summary}</p>{l.notes!.sections.map((s, i) => <div className="note-section" key={i}><h2>{s.heading}</h2><MarkdownText text={s.body}/><div className="references"><span>From the lecture</span>{s.sourceSegmentIds.map(id => { const seg = l.segments.find(x => x.id === id); return seg ? <button className="timestamp" key={id} onClick={() => seek(seg.startSeconds)}>{formatTime(seg.startSeconds)}</button> : null; })}</div></div>)}</>}
      {l.draft && <div className="draft"><h2>New generated draft</h2><p>Your saved notes have been kept. Replacing them will use this draft.</p><MarkdownText text={l.draft.summary}/>{l.draft.sections.map((s, i) => <div key={i}><h3>{s.heading}</h3><MarkdownText text={s.body}/></div>)}<div className="actions"><button className="primary" onClick={async () => { try { await api(`/lectures/${l.id}/draft`, 'POST', { accept: true }); await onRefresh(); } catch (e) { setError((e as Error).message); } }}>Replace saved notes with draft</button><button onClick={async () => { try { await api(`/lectures/${l.id}/draft`, 'POST', { accept: false }); await onRefresh(); } catch (e) { setError((e as Error).message); } }}>Keep saved notes</button></div></div>}
    </>}
  </section>;
}
function MarkdownText({ text }: { text: string }) {
  return <div className="note-body">{text.split(/\n\n+/).map((block, i) => /^#{1,3} /.test(block) ? <h3 key={i}>{block.replace(/^#{1,3} /, '')}</h3> : <p key={i}>{block}</p>)}</div>;
}
