import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Square } from 'lucide-react';
import { api, upload } from './api';
import { formatTime, MAX_SECONDS, type Lecture } from '../shared/lecture';
type Props = { ensureLecture: () => Promise<Lecture>; enabled: boolean; onSaved: (id: string) => Promise<void>; onActive: (v: boolean) => void; onError: (v: string) => void };
export function Recorder({ ensureLecture, enabled, onSaved, onActive, onError }: Props) {
  const recorder = useRef<MediaRecorder | null>(null); const lectureId = useRef('');
  const pending = useRef<{ index: number; blob: Blob }[]>([]); const next = useRef(0); const flushing = useRef<Promise<boolean> | null>(null);
  const stopped = useRef(false); const elapsed = useRef(0); const tick = useRef(0);
  const [state, setState] = useState<'idle' | 'starting' | 'recording' | 'paused' | 'saving' | 'saveError'>('idle');
  const [seconds, setSeconds] = useState(0); const [saved, setSaved] = useState(0);
  async function flush(): Promise<boolean> {
    if (flushing.current) return flushing.current;
    flushing.current = (async () => {
      while (pending.current.length) {
        const item = pending.current[0];
        try { await upload(`/lectures/${lectureId.current}/chunks/${item.index}`, item.blob); pending.current.shift(); setSaved(item.index + 1); }
        catch { if (recorder.current?.state === 'recording') { elapsed.current += performance.now() - tick.current; recorder.current.pause(); } setState('saveError'); onError('Audio saving was interrupted. Recording is paused. Retry saving before continuing; keep this tab open.'); return false; }
      }
      return true;
    })();
    const success = await flushing.current; flushing.current = null; return success;
  }
  async function finalize() {
    setState('saving'); if (!await flush()) return;
    try { await api(`/lectures/${lectureId.current}/finish-recording`, 'POST'); onActive(false); await onSaved(lectureId.current); setState('idle'); }
    catch (e) { setState('saveError'); onError((e as Error).message); }
  }
  useEffect(() => {
    const timer = setInterval(() => {
      const time = elapsed.current + (recorder.current?.state === 'recording' ? performance.now() - tick.current : 0);
      setSeconds(Math.floor(time / 1000)); if (time >= MAX_SECONDS * 1000 && recorder.current?.state !== 'inactive') recorder.current?.stop();
    }, 250);
    const unload = (e: BeforeUnloadEvent) => { if ((recorder.current && recorder.current.state !== 'inactive') || pending.current.length) e.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', unload); recorder.current?.stream.getTracks().forEach(t => t.stop()); };
  }, []);
  async function start() {
    setState('starting'); onActive(true); onError(''); let stream: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('This browser cannot record audio. Use Chrome or Edge, or upload a recording.');
      const l = await ensureLecture(); lectureId.current = l.id; stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 96000 });
      recorder.current = r; await api(`/lectures/${l.id}/recording`, 'POST', { mime: r.mimeType });
      pending.current = []; next.current = 0; stopped.current = false; elapsed.current = 0; setSaved(0); tick.current = performance.now();
      r.ondataavailable = e => { if (e.data.size) { pending.current.push({ index: next.current++, blob: e.data }); void flush(); } };
      r.onstop = () => { stopped.current = true; r.stream.getTracks().forEach(t => t.stop()); void finalize(); };
      r.onerror = () => { onError('The microphone disconnected. Saved audio can be recovered.'); if (r.state !== 'inactive') r.stop(); };
      r.start(5000); onActive(true); setState('recording');
    } catch (e) { stream?.getTracks().forEach(t => t.stop()); setState('idle'); onActive(false); onError((e as Error).name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser, or use Upload audio.' : (e as Error).message); }
  }
  function pause() { const r = recorder.current; if (!r) return; if (r.state === 'recording') { elapsed.current += performance.now() - tick.current; r.pause(); setState('paused'); } else if (r.state === 'paused') { tick.current = performance.now(); r.resume(); setState('recording'); } }
  return <div className="capture-body"><div className={`mic-symbol ${state === 'recording' ? 'live' : ''}`}><Mic size={30}/></div><div><h3>{state === 'idle' ? 'Ready when you are' : state === 'starting' ? 'Allow microphone access' : state === 'saving' ? 'Saving your recording…' : `${state === 'recording' ? 'Recording' : 'Paused'} · ${formatTime(seconds)}`}</h3><p>{state === 'idle' ? 'Up to 2 hours. Your audio is saved before processing.' : `${saved} audio chunks saved${seconds >= 7140 ? ' · Approaching the 2-hour limit' : ''}`}</p></div>
    {state === 'idle' ? <button className="primary" disabled={!enabled} onClick={() => void start()}>Start recording</button> : <div className="record-actions">{['recording', 'paused'].includes(state) && <><button onClick={pause}>{state === 'recording' ? <Pause size={17}/> : <Play size={17}/>} {state === 'recording' ? 'Pause' : 'Resume'}</button><button className="primary" onClick={() => recorder.current?.stop()}><Square size={15}/>Stop &amp; save</button></>}{state === 'saveError' && <><button onClick={async () => { onError(''); if (stopped.current) await finalize(); else if (await flush()) setState('paused'); }}>Retry saving</button>{!stopped.current && <button onClick={() => recorder.current?.stop()}>Stop &amp; save</button>}</>}</div>}
  </div>;
}
