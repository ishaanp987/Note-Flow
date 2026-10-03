import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = 'http://127.0.0.1:3100';
const logs = path.join(root, 'data', 'logs');
const receiptsFile = path.join(root, 'data', 'managed-services.json');
const ollamaBinary = path.join(root, 'tools', 'ollama', 'ollama.exe');
const serverScript = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
let receipts = {};
try { receipts = JSON.parse(readFileSync(receiptsFile, 'utf8')); } catch { /* First launch has no process receipts. */ }
const env = { ...process.env, PORT: '3100', LECTURE_DATA_DIR: path.join(root, 'data'), OLLAMA_HOST: '127.0.0.1:11434', OLLAMA_MODELS: path.join(root, 'models', 'ollama'), OLLAMA_NO_CLOUD: '1' };
if (process.argv.includes('--stop')) {
  for (const [name, binary, needle] of [['app', process.execPath, serverScript], ['local-ai', ollamaBinary, ollamaBinary]]) {
    const pid = receipts[name]; if (!Number.isSafeInteger(pid) || pid <= 0) continue;
    // Check both executable and the project-specific command before terminating its tree.
    const command = '$p = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $env:LECTURE_STOP_PID); if (!$p) { exit 0 }; if ($p.ExecutablePath -eq $env:LECTURE_EXPECT_BINARY -and $p.CommandLine.Contains($env:LECTURE_EXPECT_COMMAND)) { & "$env:SystemRoot\\System32\\taskkill.exe" /PID $p.ProcessId /T /F | Out-Null; exit $LASTEXITCODE }; Write-Error "Process identity changed; it was left running."; exit 2';
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, encoding: 'utf8', env: { ...env, LECTURE_STOP_PID: String(pid), LECTURE_EXPECT_BINARY: binary, LECTURE_EXPECT_COMMAND: needle } });
    if (result.status !== 0) { console.error(result.stderr || `Could not stop ${name}.`); process.exitCode = 1; }
    else { delete receipts[name]; console.log(`${name} stopped.`); }
  }
  if (existsSync(path.dirname(receiptsFile))) writeFileSync(receiptsFile, JSON.stringify(receipts));
  process.exit(process.exitCode || 0);
}
async function ready(address, check = () => true) {
  try { const r = await fetch(address, { signal: AbortSignal.timeout(1500) }); return r.ok && check(await r.json()); } catch { return false; }
}
function background(binary, args, name) {
  mkdirSync(logs, { recursive: true });
  const out = openSync(path.join(logs, `${name}.log`), 'a');
  const child = spawn(binary, args, { cwd: root, env, windowsHide: true, detached: true, stdio: ['ignore', out, out] });
  child.on('error', e => console.error(`${name} could not start: ${e.message}`));
  receipts[name] = child.pid; writeFileSync(receiptsFile, JSON.stringify(receipts));
  child.unref(); closeSync(out);
}
async function waitFor(address, check) {
  for (let i = 0; i < 30; i++) { if (await ready(address, check)) return true; await new Promise(r => setTimeout(r, 1000)); }
  return false;
}
if (!existsSync(path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')) || !existsSync(path.join(root, 'dist', 'client', 'index.html'))) {
  console.error('The installed app files are missing. See README.md for setup and build instructions.'); process.exit(1);
}
if (!await ready('http://127.0.0.1:11434/api/tags')) {
  if (existsSync(ollamaBinary)) { background(ollamaBinary, ['serve'], 'local-ai'); await waitFor('http://127.0.0.1:11434/api/tags'); }
  else console.log('Local AI is not installed. Open Settings for setup.');
}
const isApp = json => json.name === 'Lecture Notes' && json.status === 'ok' && json.localOnly === true;
if (!await ready(`${url}/api/health`, isApp)) {
  background(process.execPath, [serverScript, 'src/server/index.ts', '--production'], 'app');
  if (!await waitFor(`${url}/api/health`, isApp)) { console.error('The app could not start. Check data/logs/app.log. Another program may be using port 3100.'); process.exit(1); }
}
console.log(`Lecture Notes is ready: ${url}`);
if (!process.argv.includes('--no-browser')) {
  const child = spawn(process.env.ComSpec || 'cmd.exe', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' }); child.unref();
}
