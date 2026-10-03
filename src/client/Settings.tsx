import { useEffect, useState } from 'react';
import { Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from './api';
type Config = { engine: 'groq' | 'local'; hasKey: boolean; freeConfirmed: boolean; whisperPath: string; whisperModel: string; localModel: string; readiness: { cloud: boolean; whisper: boolean; ollama: boolean; ollamaModels: string[] } };
export function Settings({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<Config | null>(null); const [key, setKey] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  async function load() { const c = await api<Config>('/settings'); setConfig(c); setConfirmed(c.freeConfirmed); }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  async function save(clearKey = false) {
    if (!config) return; setSaving(true); setError('');
    try { await api('/settings', 'PUT', { engine: config.engine, whisperPath: config.whisperPath, whisperModel: config.whisperModel, localModel: config.localModel, ...(key ? { key, freeConfirmed: confirmed } : {}), clearKey }); setKey(''); await load(); setMessage('Settings saved.'); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <div className="workspace settings-page"><div className="page-heading"><div><h1>AI engine settings</h1><p>Free cloud processing, or models on your laptop.</p></div><button onClick={onClose}>Back to lecture</button></div>
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
    {config && <><label>Preferred engine<select value={config.engine} onChange={e => setConfig({ ...config, engine: e.target.value as Config['engine'] })}><option value="groq">Groq — Free plan</option><option value="local">Local — on this laptop</option></select></label>
      <section className="settings-section"><h2>Free cloud AI</h2><p>Cloud processing sends lecture audio and transcript text to Groq. Use an account on its Free plan; this app does not enable billing or switch to a paid service.</p><p><a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Open Groq API keys</a> · <a href="https://console.groq.com/settings/billing" target="_blank" rel="noreferrer">Check your account plan</a></p>
        <label>Groq API key<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={config.hasKey ? 'A key is configured for this session' : 'Enter your Free-plan API key here'}/></label>
        <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I checked that this account is on the Free plan with no paid billing enabled.</label>
        <p className="hint"><Info size={16}/>The key stays in this running local server's memory. Re-enter it after a restart. Never paste it into chat.</p>
        <div className="readiness">{config.readiness.cloud ? <CheckCircle2 size={17}/> : <AlertCircle size={17}/>} {config.readiness.cloud ? 'Cloud key configured. Real processing will validate it.' : 'Cloud processing is disabled until a Free-plan key is configured.'}</div>
        {config.hasKey && <button onClick={() => void save(true)} disabled={saving}>Clear cloud key</button>}
      </section>
      <section className="settings-section"><h2>Local AI</h2><p>Transcription uses whisper.cpp. Notes use a downloaded Ollama model at 127.0.0.1:11434. Local mode does not send lecture content to a cloud provider.</p>
        <label>whisper.cpp executable<input value={config.whisperPath} onChange={e => setConfig({ ...config, whisperPath: e.target.value })}/></label>
        <label>Speech model file<input value={config.whisperModel} onChange={e => setConfig({ ...config, whisperModel: e.target.value })}/></label>
        <label>Local Ollama model<input list="ollama-models" value={config.localModel} onChange={e => setConfig({ ...config, localModel: e.target.value })}/><datalist id="ollama-models">{config.readiness.ollamaModels.map(m => <option key={m} value={m}/>)}</datalist></label>
        <div className="readiness">{config.readiness.whisper ? <CheckCircle2 size={17}/> : <AlertCircle size={17}/>}Speech tool and model {config.readiness.whisper ? 'found' : 'need setup'}</div>
        <div className="readiness">{config.readiness.ollama ? <CheckCircle2 size={17}/> : <AlertCircle size={17}/>}Local note model {config.readiness.ollama ? 'available' : 'not ready — start Ollama and download the selected model'}</div>
        <p>Local tools and model setup instructions are included in your launch guide. Model downloads require internet once; processing can then run locally.</p>
      </section><div className="actions"><button className="primary" onClick={() => void save()} disabled={saving || (!!key && !confirmed)}>{saving ? 'Saving…' : 'Save settings'}</button><button onClick={() => load().catch(e => setError(e.message))}>Check readiness</button></div></>}
  </div>;
}
