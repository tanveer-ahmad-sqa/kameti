import { normalizePkMobile } from '@shared/schemas/phone';

export type RawContact = {
  id: string;
  fullName?: string | null;
  phones?: { number?: string | null }[] | null;
};

export type ContactRow = {
  key: string;
  name: string;
  phone: string; // E.164
  alreadyAdded: boolean;
};

/**
 * One row per (contact, valid Pakistani mobile). Numbers are normalized and de-duplicated,
 * so the same person saved twice or with "0300…" and "+92300…" shows once. Sorted by name.
 */
export function buildContactRows(
  contacts: RawContact[],
  existingPhones: Set<string>,
  unnamed: string,
): ContactRow[] {
  const seen = new Set<string>();
  const rows: ContactRow[] = [];

  for (const contact of contacts) {
    const name = contact.fullName?.trim() || unnamed;
    for (const phone of contact.phones ?? []) {
      const e164 = phone.number ? normalizePkMobile(phone.number) : null;
      if (!e164 || seen.has(e164)) continue;
      seen.add(e164);
      rows.push({ key: `${contact.id}:${e164}`, name, phone: e164, alreadyAdded: existingPhones.has(e164) });
    }
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive match on name, or on digits typed in any phone format. */
export function filterContactRows(rows: ContactRow[], query: string): ContactRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const digits = q.replace(/\D/g, '');
  // A number typed with a 0 / 92 / +92 prefix is typed from the start: match as a prefix of
  // the local number (300…). Bare digits ("1234") match anywhere in the number.
  const prefixed = /^(0092|92|0)/.test(digits);
  const localDigits = digits.replace(/^(0092|92|0)/, '');
  const matchesPhone = (phone: string) => {
    if (localDigits.length < 3) return false;
    const local = phone.slice(3);
    return prefixed ? local.startsWith(localDigits) : local.includes(localDigits);
  };
  return rows.filter((row) => row.name.toLowerCase().includes(q) || matchesPhone(row.phone));
}
