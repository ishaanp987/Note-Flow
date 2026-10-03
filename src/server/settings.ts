import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Engine } from '../shared/lecture';
const schema = z.object({ engine: z.enum(['groq', 'local']), whisperPath: z.string().max(2000), whisperModel: z.string().max(2000), localModel: z.string().regex(/^[a-zA-Z0-9_.:/-]+$/).refine(v => !/cloud/i.test(v), 'Choose a local model, not a cloud model.') });
export class Settings {
  key = ''; freeConfirmed = false;
  config: z.infer<typeof schema>;
  constructor(private dir: string) {
    const defaults = { engine: 'groq' as Engine, whisperPath: path.resolve('tools/whisper/Release/whisper-cli.exe'), whisperModel: path.resolve('models/ggml-small.en-q5_1.bin'), localModel: 'qwen3:4b' };
    try { this.config = schema.parse(JSON.parse(readFileSync(path.join(dir, 'settings.json'), 'utf8'))); } catch { this.config = defaults; }
  }
  save(input: unknown) {
    const parsed = schema.extend({ key: z.string().max(300).optional(), freeConfirmed: z.boolean().optional(), clearKey: z.boolean().optional() }).parse(input);
    if (parsed.clearKey) { this.key = ''; this.freeConfirmed = false; }
    if (parsed.key) { if (!parsed.freeConfirmed) throw new Error('Confirm that your Groq account is on the Free plan before enabling cloud processing.'); this.key = parsed.key.trim(); this.freeConfirmed = true; }
    this.config = schema.parse(parsed); writeFileSync(path.join(this.dir, 'settings.json'), JSON.stringify(this.config, null, 2));
    return this.public();
  }
  public() { return { ...this.config, hasKey: !!this.key, freeConfirmed: this.freeConfirmed, keyStorage: 'The API key is held only in this running local server. Re-enter it after a restart.' }; }
  async readiness() {
    let ollamaModels: string[] = [];
    try { const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) }); const j = await r.json() as { models?: { name: string }[] }; ollamaModels = (j.models || []).map(m => m.name).filter(n => !/cloud/i.test(n)); } catch { /* Unavailable local service is a readiness state. */ }
    return { cloud: !!this.key && this.freeConfirmed, whisper: existsSync(this.config.whisperPath) && existsSync(this.config.whisperModel), ollama: ollamaModels.includes(this.config.localModel), ollamaModels };
  }
}
