import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, nextRandom } from './rng';

describe('public seed and serializable random stream', () => {
  it('produces identical streams from identical settlement material', () => {
    const seed = hashString('2026-11-04|0xabc|1173');
    const first = mulberry32(seed);
    const second = mulberry32(seed);
    expect(Array.from({ length: 100 }, first)).toEqual(Array.from({ length: 100 }, second));
    expect(hashString('2026-11-05|0xabc|1173')).not.toBe(seed);
  });

  it('resumes from its serialized state without changing the sequence', () => {
    const rng = mulberry32(42);
    const first = nextRandom(42);
    expect(rng()).toBe(first.value);
    expect(rng()).toBe(nextRandom(first.state).value);
    expect(first.value).toBeGreaterThanOrEqual(0);
    expect(first.value).toBeLessThan(1);
  });
});
