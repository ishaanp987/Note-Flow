import { useCallback, useEffect, useRef, useState } from 'react';
import { Info, Mic, Upload, Download, Trash2 } from 'lucide-react';
import { api, upload } from './api';
import { formatTime, busy, type Lecture, type Engine } from '../shared/lecture';
import { Recorder } from './Recorder';
import { Settings } from './Settings';
import { StudyDocument } from './StudyDocument';

type Props = { lecture: Lecture | null; settings: boolean; onSelect: (id: string) => Promise<void>; onRefresh: () => Promise<void>; onRecording: (value: boolean) => void; onCloseSettings: () => void };
export function Workspace({ lecture, settings, onSelect, onRefresh, onRecording, onCloseSettings }: Props) {
  const [title, setTitle] = useState(lecture?.title || ''); const [course, setCourse] = useState(lecture?.course || '');
  const [vocabulary, setVocabulary] = useState(''); const [editing, setEditing] = useState(false);
  const onEditing = useCallback((value: boolean) => { setEditing(value); onRecording(value); }, [onRecording]);
  const [mode, setMode] = useState<'record' | 'upload'>('record'); const [tab, setTab] = useState('notes');
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [working, setWorking] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const created = useRef<Lecture | null>(lecture); const [engine, setEngine] = useState<Engine>(lecture?.engine || 'groq'); const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { if (!lecture || lecture.status === 'audio') api<{ engine: Engine }>('/settings').then(s => setEngine(s.engine)).catch(() => {}); }, [lecture?.id]);
  async function ensureLecture() { if (created.current) return created.current; created.current = await api<Lecture>('/lectures', 'POST', { title, course, vocabulary }); return created.current; }
  async function processLecture() { if (!lecture) return; setError(''); try { await api(`/lectures/${lecture.id}/process`, 'POST', { engine, notesOnly: !!lecture.segments.length }); await onRefresh(); } catch (e) { setError((e as Error).message); } }
  async function fileSelected(file?: File) {
    if (!file) return; setSaving(true); setError('');
    try { if (file.size > 2 * 1024 ** 3) throw new Error('Choose a file up to 2 GiB.'); const l = await ensureLecture(); await upload(`/lectures/${l.id}/audio`, file, file.name); await onSelect(l.id); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  if (settings) return <Settings onClose={onCloseSettings}/>;
  return <div className="workspace">
    <div className="intro"><h1>{lecture?.title || 'Start with a lecture'}</h1><p>{lecture ? lecture.course || 'Your lecture workspace' : 'Record your microphone or upload audio. Turn it into detailed study notes.'}</p></div>
    {!lecture && <div className="metadata"><label>Lecture title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Introduction to biology" maxLength={200}/></label><label>Course (optional)<input value={course} onChange={e => setCourse(e.target.value)} placeholder="e.g. BIO 101" maxLength={100}/></label>
    <details className="vocabulary"><summary>Vocabulary hints (optional)</summary><label>Names and specialist terms<textarea value={vocabulary} onChange={e => setVocabulary(e.target.value)} maxLength={1000} placeholder="e.g. mitochondria, endoplasmic reticulum"/></label></details></div>}
    {error && <p className="error" role="alert">{error}</p>}
    {!lecture?.audioFile && <section className="capture"><div className="tabs"><button className={mode === 'record' ? 'selected' : ''} disabled={working || saving} onClick={() => setMode('record')}>Record microphone</button><button className={mode === 'upload' ? 'selected' : ''} disabled={working || saving} onClick={() => setMode('upload')}>Upload audio</button></div>
      {mode === 'record' ? <Recorder ensureLecture={ensureLecture} enabled={!!(lecture?.title || title.trim())} onSaved={onSelect} onActive={value => { setWorking(value); onRecording(value); }} onError={setError}/> : <div className="capture-body"><div className="mic-symbol"><Upload size={28}/></div><div><h3>{saving ? 'Saving and checking audio…' : 'Bring your recording'}</h3><p>MP3, M4A, WAV, or WebM. Up to 2 hours.</p></div><label className={`file-button primary ${saving || !(lecture?.title || title.trim()) ? 'disabled' : ''}`}>{saving ? 'Saving…' : 'Choose audio'}<input aria-label="Choose audio" type="file" accept=".mp3,.m4a,.wav,.webm" disabled={saving || !(lecture?.title || title.trim())} onChange={e => { void fileSelected(e.target.files?.[0]); e.target.value = ''; }}/></label></div>}
    </section>}
    {lecture && !lecture.audioFile && lecture.recordingChunks > 0 && !working && <button className="recovery" disabled={saving} onClick={async () => { setSaving(true); try { await api(`/lectures/${lecture.id}/finish-recording`, 'POST'); await onRefresh(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }}>Recover saved recording chunks</button>}
    {lecture?.audioFile && <div className="audio-strip"><Mic size={21}/><div><strong>Original audio</strong><span>{formatTime(lecture.duration)} · Saved on this laptop</span></div><audio ref={audio} controls preload="metadata" src={`/api/lectures/${lecture.id}/audio`}/><a href={`/api/lectures/${lecture.id}/audio?download=1`} aria-label="Download original audio"><Download size={19}/></a></div>}
    {lecture?.audioFile && <div className="processing-controls"><label>AI engine<select value={engine} disabled={busy(lecture.status)} onChange={e => setEngine(e.target.value as Engine)}><option value="groq">Groq — Free plan</option><option value="local">Local — on this laptop</option></select></label>{busy(lecture.status) ? <button onClick={async () => { await api(`/lectures/${lecture.id}/stop`, 'POST'); await onRefresh(); }}>Stop processing</button> : <button className="primary" onClick={() => void processLecture()}>{lecture.notes ? 'Regenerate notes' : lecture.status === 'failed' || lecture.status === 'waiting' || lecture.status === 'interrupted' ? 'Resume processing' : 'Transcribe & generate notes'}</button>}</div>}
    <p className={`hint ${lecture?.status === 'failed' ? 'error' : ''}`} role="status" aria-live="polite"><Info size={17}/>{lecture?.message || 'Choose an AI engine in Settings before generating notes.'}{lecture?.progress && <span>({lecture.progress.done}/{lecture.progress.total} saved)</span>}</p>
    <div className="document-tabs tabs" role="tablist" aria-label="Lecture content"><button role="tab" disabled={editing} aria-selected={tab === 'notes'} className={tab === 'notes' ? 'selected' : ''} onClick={() => setTab('notes')}>Study notes</button><button role="tab" disabled={editing} aria-selected={tab === 'transcript'} className={tab === 'transcript' ? 'selected' : ''} onClick={() => setTab('transcript')}>Transcript</button><button className="export" disabled={editing || (tab === 'notes' ? !lecture?.notesMarkdown : !lecture?.segments.length)} onClick={() => { if (lecture) window.location.assign(`/api/lectures/${lecture.id}/export?type=${tab === 'notes' ? 'notes' : 'transcript'}`); }}><Upload size={19}/>Export</button></div>
    <StudyDocument key={tab} lecture={lecture} tab={tab} onRefresh={onRefresh} onEditing={onEditing} seek={seconds => { if (audio.current) { audio.current.currentTime = seconds; void audio.current.play().catch(() => {}); } }}/>
    {lecture && !working && !editing && <div className="delete-area">{confirmDelete ? <><span>Delete this lecture and all its saved audio and notes?</span><button onClick={() => setConfirmDelete(false)}>Cancel</button><button className="danger" disabled={busy(lecture.status)} onClick={async () => { try { await api(`/lectures/${lecture.id}`, 'DELETE'); await onSelect(''); } catch (e) { setError((e as Error).message); } }}>Delete lecture permanently</button></> : <button className="quiet" disabled={busy(lecture.status)} onClick={() => setConfirmDelete(true)}><Trash2 size={15}/>Delete lecture</button>}</div>}
    <footer><Info size={16}/>Keep this tab open and your laptop awake while recording.</footer>
  </div>;
}
