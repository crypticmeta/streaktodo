import { describe, expect, it } from 'vitest';
import { queryChunks } from '../query';

describe('queryChunks', () => {
  it('keeps every query below the requested bind limit', () => {
    const values = Array.from({ length: 1_001 }, (_, index) => `task-${index}`);
    const chunks = queryChunks(values, 400);
    expect(chunks.map((chunk) => chunk.length)).toEqual([400, 400, 201]);
    expect(chunks.flat()).toEqual(values);
  });

  it('deduplicates ids before querying', () => {
    expect(queryChunks(['a', 'a', 'b'], 2)).toEqual([['a', 'b']]);
  });
});
