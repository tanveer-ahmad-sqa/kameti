import { buildContactRows, filterContactRows } from '../contactRows';

const contacts = [
  { id: '1', fullName: 'Zara', phones: [{ number: '0300 1234567' }, { number: '+92 300 1234567' }] },
  { id: '2', fullName: 'Ali', phones: [{ number: '042 35555555' }, { number: '0345-7654321' }] },
  { id: '3', fullName: null, phones: [{ number: '03111111111' }] },
  { id: '4', fullName: 'Foreign', phones: [{ number: '+1 415 555 2671' }] },
  { id: '5', fullName: 'No phone', phones: [] },
  { id: '6', fullName: 'Zara (work)', phones: [{ number: '03001234567' }] },
];

describe('buildContactRows', () => {
  const rows = buildContactRows(contacts, new Set(['+923457654321']), 'No name');

  it('keeps only valid Pakistani mobiles, normalized and de-duplicated', () => {
    expect(rows.map((r) => r.phone)).toEqual(['+923457654321', '+923111111111', '+923001234567']);
  });

  it('names unnamed contacts and sorts by name', () => {
    expect(rows.map((r) => r.name)).toEqual(['Ali', 'No name', 'Zara']);
  });

  it('marks numbers already in the committee', () => {
    expect(rows.find((r) => r.name === 'Ali')?.alreadyAdded).toBe(true);
    expect(rows.find((r) => r.name === 'Zara')?.alreadyAdded).toBe(false);
  });
});

describe('filterContactRows', () => {
  const rows = buildContactRows(contacts, new Set(), 'No name');

  it('matches names case-insensitively', () => {
    expect(filterContactRows(rows, 'zA').map((r) => r.name)).toEqual(['Zara']);
  });

  it('matches numbers in local or international format', () => {
    expect(filterContactRows(rows, '0345 765').map((r) => r.name)).toEqual(['Ali']);
    expect(filterContactRows(rows, '+92345').map((r) => r.name)).toEqual(['Ali']);
  });

  it('returns everything for an empty query', () => {
    expect(filterContactRows(rows, '  ')).toHaveLength(3);
  });
});
