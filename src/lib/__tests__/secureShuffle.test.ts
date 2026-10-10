import { randomIntBelow, secureShuffle } from '@shared/secureShuffle';

describe('randomIntBelow', () => {
  it('rejects values in the biased top bucket and redraws', () => {
    // For n = 3, the limit is 2^32 - (2^32 % 3) = 4294967295; 4294967295 itself must be rejected.
    const values = [4294967295, 7];
    const random = jest.fn(() => values.shift() as number);
    expect(randomIntBelow(3, random)).toBe(7 % 3);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('validates n', () => {
    expect(() => randomIntBelow(0)).toThrow(RangeError);
    expect(() => randomIntBelow(1.5)).toThrow(RangeError);
  });

  it('always returns 0 for n = 1', () => {
    expect(randomIntBelow(1)).toBe(0);
  });
});

describe('secureShuffle', () => {
  it('returns a permutation and does not mutate the input', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const output = secureShuffle(input);
    expect([...output].sort()).toEqual(input);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('handles empty and single-item lists', () => {
    expect(secureShuffle([])).toEqual([]);
    expect(secureShuffle(['x'])).toEqual(['x']);
  });

  it('is deterministic for a given random source (Fisher-Yates from the end)', () => {
    // i=3: j=0 -> swap(3,0) => d b c a; i=2: j=2 -> no-op; i=1: j=0 -> swap(1,0) => b d c a
    const draws = [0, 2, 0];
    expect(secureShuffle(['a', 'b', 'c', 'd'], () => draws.shift() as number)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('produces every permutation with equal frequency (crypto source)', () => {
    const runs = 60_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < runs; i++) {
      const key = secureShuffle([1, 2, 3]).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    // Expected 10,000 each; 6 standard deviations is ~±550. Allow ±5%.
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(9_500);
      expect(count).toBeLessThan(10_500);
    }
  });
});
