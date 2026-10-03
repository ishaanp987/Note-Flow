import { test, expect } from '@playwright/test';
import path from 'node:path';
import { copyFileSync, readFileSync } from 'node:fs';
import { Store } from '../../src/server/storage';
import type { Lecture } from '../../src/shared/lecture';
test('upload, playback, reload, search, and explicit deletion work in the browser', async ({ page }) => {
  const name = `QA upload ${Date.now()}`;
  await page.goto('/'); await page.getByRole('button', { name: 'New lecture', exact: true }).click();
  await page.getByLabel('Lecture title', { exact: true }).fill(name); await page.getByRole('button', { name: 'Upload audio', exact: true }).click();
  await page.getByText('Vocabulary hints (optional)', { exact: true }).click(); await page.getByLabel('Names and specialist terms').fill('osmosis, diffusion');
  await page.getByLabel('Choose audio').setInputFiles(path.resolve('tests/fixtures/cells.wav'));
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const saved = await (await page.request.get('/api/lectures')).json(); expect(saved.find((item: Lecture) => item.title === name).vocabulary).toBe('osmosis, diffusion');
  await expect.poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.readyState), { timeout: 10000 }).toBeGreaterThanOrEqual(1);
  const duration = await page.locator('audio').evaluate((el: HTMLAudioElement) => el.duration); expect(duration).toBeGreaterThan(30);
  await page.reload(); await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.locator('audio')).toBeVisible(); await page.getByLabel('Search lectures').fill(name);
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await page.getByRole('button', { name: 'Delete lecture', exact: true }).click(); await page.getByRole('button', { name: 'Delete lecture permanently' }).click();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
});
test('microphone capture with a synthetic device saves and plays audio', async ({ page }) => {
  const name = `QA recording ${Date.now()}`;
  await page.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      const stream = await capture(options); Object.assign(window, { qaStream: stream }); return stream;
    };
  });
  await page.goto('/'); await page.getByLabel('Lecture title', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByRole('button', { name: 'New lecture', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.getByText('1 audio chunks saved')).toBeVisible({ timeout: 12000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Stop & save' }).click(); await expect(page.locator('audio')).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => (window as unknown as { qaStream: MediaStream }).qaStream.getTracks().every(t => t.readyState === 'ended'))).toBe(true);
  await page.getByRole('button', { name: 'Delete lecture', exact: true }).click(); await page.getByRole('button', { name: 'Delete lecture permanently' }).click();
});
test('denied microphone permission keeps uploads available', async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] }); const page = await context.newPage();
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied in QA', 'NotAllowedError'); }; });
  await page.goto('/'); await page.getByLabel('Lecture title', { exact: true }).fill(`QA denied ${Date.now()}`); await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone permission was denied');
  await page.getByRole('button', { name: 'Upload audio', exact: true }).click(); await expect(page.getByLabel('Choose audio')).toBeEnabled();
  await page.getByRole('button', { name: /QA denied/ }).click(); await page.getByRole('button', { name: 'Delete lecture', exact: true }).click(); await page.getByRole('button', { name: 'Delete lecture permanently' }).click(); await context.close();
});
test('a failed chunk save pauses recording and retry preserves the captured audio', async ({ page }) => {
  let failOnce = true;
  await page.route('**/api/lectures/*/chunks/*', async route => {
    if (failOnce) { failOnce = false; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated temporary save failure' }) }); }
    else await route.continue();
  });
  const name = `QA save retry ${Date.now()}`; await page.goto('/'); await page.getByLabel('Lecture title', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByRole('alert')).toContainText('Recording is paused', { timeout: 12000 });
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click(); await expect(page.getByText('1 audio chunks saved')).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click(); await page.getByRole('button', { name: 'Stop & save' }).click();
  await expect(page.locator('audio')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.duration)).toBeGreaterThan(4);
  await page.getByRole('button', { name: 'Delete lecture', exact: true }).click(); await page.getByRole('button', { name: 'Delete lecture permanently' }).click();
});
test('workspace has no horizontal overflow at laptop and tablet widths', async ({ page }) => {
  for (const width of [1536, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 1024 }); await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Start with a lecture' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    if (width === 1536) await page.screenshot({ path: path.resolve('outputs/APP-PREVIEW.png'), fullPage: true });
    if (width === 390) await page.screenshot({ path: path.resolve('outputs/MOBILE-PREVIEW.png'), fullPage: true });
  }
});
test('saved transcript corrections and note edits reopen and export correctly', async ({ page }) => {
  const fixture = JSON.parse(readFileSync('tests/fixtures/cells-result.json', 'utf8')) as Pick<Lecture, 'segments' | 'notes' | 'notesMarkdown' | 'duration'>;
  const store = new Store(path.resolve('work/e2e-data')); const name = `QA real-result edits ${Date.now()}`;
  const l = store.create({ title: name }); copyFileSync('tests/fixtures/cells.wav', path.join(store.folder(l.id), 'original.wav'));
  store.update(l.id, { ...fixture, audioFile: 'original.wav', audioName: 'cells.wav', status: 'ready', transcriptVersion: 1, notesVersion: 1, notesRevision: 1, engine: 'local' }); store.close();
  await page.goto('/'); await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Transcript', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'New lecture', exact: true })).toBeDisabled();
  await page.getByLabel('Edit study notes', { exact: true }).fill(fixture.notesMarkdown + '\n\nMy revision: review diffusion before class.');
  await page.getByRole('button', { name: 'Save edits', exact: true }).click();
  await expect(page.getByText('Your edited notes', { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByText('My revision: review diffusion before class.', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click();
  const notes = await download; expect(notes.suggestedFilename()).toMatch(/\.md$/); expect(readFileSync((await notes.path())!, 'utf8')).toContain('My revision: review diffusion');
  await page.getByRole('tab', { name: 'Transcript', exact: true }).click();
  await page.getByRole('button', { name: 'Edit transcript', exact: true }).click();
  const first = fixture.segments[0]; await page.getByLabel(`Transcript at ${String(Math.floor(first.startSeconds / 60)).padStart(2, '0')}:${String(Math.floor(first.startSeconds % 60)).padStart(2, '0')}`, { exact: true }).fill('Today we will discuss cells. My saved correction.');
  await page.getByRole('button', { name: 'Save edits', exact: true }).click();
  const transcriptDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect(readFileSync((await (await transcriptDownload).path())!, 'utf8')).toContain('My saved correction.');
  await page.getByRole('button', { name: '00:17', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThanOrEqual(17);
  await page.getByRole('tab', { name: 'Study notes', exact: true }).click(); await expect(page.getByText(/The transcript has changed/)).toBeVisible();
  await page.getByRole('button', { name: 'Delete lecture', exact: true }).click(); await page.getByRole('button', { name: 'Delete lecture permanently' }).click();
});
