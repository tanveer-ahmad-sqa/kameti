// Shared between the app (via the `@shared/*` path alias, for tests) and Deno edge functions.
// Keep this file free of platform APIs beyond the Web Crypto global.

/** Returns a uniformly random unsigned 32-bit integer. */
export type RandomUint32 = () => number;

/** Cryptographically secure source (Web Crypto: available in Deno, browsers and Node 19+). */
export const cryptoRandomUint32: RandomUint32 = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] as number;
};

const UINT32_RANGE = 2 ** 32;

/**
 * Uniform integer in [0, n) without modulo bias: values from the top, incomplete
 * "bucket" of the 32-bit range are rejected and redrawn.
 */
export function randomIntBelow(n: number, random: RandomUint32 = cryptoRandomUint32): number {
  if (!Number.isInteger(n) || n <= 0 || n > UINT32_RANGE) {
    throw new RangeError(`randomIntBelow: n must be an integer in [1, 2^32], got ${n}`);
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % n);
  let value = random();
  while (value >= limit) {
    value = random();
  }
  return value % n;
}

/** Fisher–Yates shuffle. Every permutation is equally likely with an unbiased source. */
export function secureShuffle<T>(items: readonly T[], random: RandomUint32 = cryptoRandomUint32): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIntBelow(i + 1, random);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Recorded with every draw so the method is auditable. */
export const SHUFFLE_ALGORITHM = 'fisher-yates+crypto.getRandomValues+rejection-sampling/v1';
