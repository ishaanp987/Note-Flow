import { afterEach, expect, test, vi } from 'vitest';
import { groqProvider } from '../../src/server/providers/groq';
import { Settings } from '../../src/server/settings';
import { QuotaError } from '../../src/server/providers/contracts';
import os from 'node:os';
const signal = new AbortController().signal;
const settings = () => { const s = new Settings(os.tmpdir()); s.key = 'unit-test-only'; s.freeConfirmed = true; return s; };
const segments = [{ id: 's1', startSeconds: 0, endSeconds: 1, text: 'A cell is a unit of life.' }];
afterEach(() => { vi.restoreAllMocks(); });
test('cloud is disabled before the Free-plan confirmation and never makes a request', async () => {
  const s = settings(); s.freeConfirmed = false; const network = vi.spyOn(globalThis, 'fetch');
  await expect(groqProvider(s).notes(segments, signal)).rejects.toThrow('confirmed Groq Free-plan'); expect(network).not.toHaveBeenCalled();
});
test('quota waits honor both seconds and HTTP-date Retry-After without automatic resubmission', async () => {
  for (const header of ['120', new Date(Date.now() + 120000).toUTCString()]) {
    const network = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': header } }));
    const error = await groqProvider(settings()).notes(segments, signal).catch(e => e);
    expect(error).toBeInstanceOf(QuotaError); expect(error.retryAt - Date.now()).toBeGreaterThan(118000); expect(network).toHaveBeenCalledTimes(1); network.mockRestore();
  }
});
