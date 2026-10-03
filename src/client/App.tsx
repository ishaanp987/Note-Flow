import { useEffect, useState } from 'react';
import { BookOpen, Plus, Search, Settings as SettingsIcon } from 'lucide-react';
import { api, initialize } from './api';
import type { Lecture } from '../shared/lecture';
import { Workspace } from './Workspace';

export function App() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(false);
  const [recording, setRecording] = useState(false);
  async function refresh() { setLectures(await api<Lecture[]>('/lectures')); }
  useEffect(() => {
    let alive = true;
    initialize().then(refresh).then(() => { if (alive) setReady(true); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => refresh().catch(() => {}), 3000);
    return () => clearInterval(interval);
  }, [ready]);
  const lecture = lectures.find(l => l.id === selected) || null;
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><BookOpen size={30}/><strong>Lecture Notes</strong></div>
      <button className="primary full" disabled={recording} onClick={() => { setSelected(null); setSettings(false); setError(''); }}><Plus size={18}/>New lecture</button>
      <label className="search"><Search size={19}/><input aria-label="Search lectures" placeholder="Search lectures" value={search} onChange={e => setSearch(e.target.value)}/></label>
      <h2 className="library-label">Your lectures</h2>
      <div className="library-list">{lectures.filter(l => `${l.title} ${l.course}`.toLowerCase().includes(search.toLowerCase())).map(l => <button className={`library-row ${l.id === selected ? 'active' : ''}`} key={l.id} disabled={recording} onClick={() => { setSelected(l.id); setSettings(false); setError(''); }}><strong>{l.title}</strong><span>{[l.course, new Date(l.createdAt).toLocaleDateString(), l.status === 'audio' ? 'Audio saved' : l.status].filter(Boolean).join(' · ')}</span></button>)}</div>
      {!lectures.length && <p className="empty-library">Your lectures will appear here</p>}
      <button className="settings-button" disabled={recording} onClick={() => setSettings(true)}><SettingsIcon size={21}/>Settings</button>
    </aside>
    <main><header className="topbar"><span>Library <span className="slash">/</span> <b>{settings ? 'Settings' : lecture?.title || 'New lecture'}</b></span><span>Saved on this laptop</span></header>
      {error && <div className="error global-error" role="alert">{error}</div>}
      {ready && <Workspace key={settings ? 'settings' : selected || 'new'} lecture={lecture} settings={settings} onSelect={async id => { await refresh(); setSelected(id); }} onRefresh={refresh} onRecording={setRecording} onCloseSettings={() => setSettings(false)}/>}
    </main>
  </div>;
}
