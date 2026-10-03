import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/server/storage';
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })));
test('reopens saved lectures without losing user text', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lecture-test-')); dirs.push(dir);
  const a = new Store(dir); const lecture = a.create({ title: 'Biology <cells>', course: 'BIO 101', vocabulary: '' }); a.close();
  const b = new Store(dir); expect(b.get(lecture.id).title).toBe('Biology <cells>'); expect(b.list()).toHaveLength(1); b.close();
});
test('does not create an empty lecture and refuses unknown IDs', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lecture-test-')); dirs.push(dir); const s = new Store(dir);
  expect(() => s.create({ title: '  ', course: '', vocabulary: '' })).toThrow();
  expect(() => s.get('../anything')).toThrow(); s.close();
});
