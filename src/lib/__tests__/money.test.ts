import { formatPKR, potAmount } from '@shared/money';

describe('formatPKR', () => {
  it.each([
    [0, 'Rs 0'],
    [500, 'Rs 500'],
    [10000, 'Rs 10,000'],
    [250000, 'Rs 250,000'],
    [1500000, 'Rs 1,500,000'],
    [-2000, '-Rs 2,000'],
  ])('formats %d as %s', (amount, expected) => {
    expect(formatPKR(amount)).toBe(expected);
  });

  it('refuses non-integer amounts (money is whole rupees)', () => {
    expect(() => formatPKR(10.5)).toThrow(RangeError);
  });
});

describe('potAmount', () => {
  it('is contribution x members', () => {
    expect(potAmount(10000, 12)).toBe(120000);
  });
});
