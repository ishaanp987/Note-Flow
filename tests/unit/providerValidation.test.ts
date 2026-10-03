import { expect, test } from 'vitest';
import { mapSegments, validateNotes, groupTranscript } from '../../src/server/providers/contracts';
test('maps local timestamps onto the lecture timeline and rejects out-of-bounds segments', () => {
  expect(mapSegments([{ start: 1, end: 4, text: 'Cell membrane' }], 600, 600, 1)[0]).toMatchObject({ startSeconds: 601, endSeconds: 604, text: 'Cell membrane' });
  expect(() => mapSegments([{ start: 9, end: 15, text: 'bad' }], 0, 10, 0)).toThrow();
});
test('rejects invented source references in generated notes', () => {
  expect(() => validateNotes({ summary: 'Cells', sections: [{ heading: 'Cell', body: 'Definition', sourceSegmentIds: ['invented'] }] }, ['s1'])).toThrow();
});
test('long-transcript sectioning retains beginning middle and final content', () => {
  const segments = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, text: 'words '.repeat(100), startSeconds: i, endSeconds: i + 1 }));
  const groups = groupTranscript(segments, 2000);
  expect(groups.flat().map(s => s.id)).toEqual(segments.map(s => s.id));
  expect(groups.length).toBeGreaterThan(10);
});
