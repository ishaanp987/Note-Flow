import { expect, test } from 'vitest';
import { health } from '../../src/server/health';
test('identifies the local service without revealing credentials', () => {
  expect(health()).toEqual({ name: 'Lecture Notes', status: 'ok', localOnly: true });
});
