// Shared between the app (via the `@shared/*` path alias) and Deno edge functions.
// All amounts are whole rupees stored as integers. Never use floats for money.

/** 10000 -> "Rs 10,000". Western digit grouping, as used on Pakistani bank/wallet apps. */
export function formatPKR(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`formatPKR expects an integer number of rupees, got ${amount}`);
  }
  const sign = amount < 0 ? '-' : '';
  const grouped = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}Rs ${grouped}`;
}

/** Total pot for one month: contribution x number of members. */
export function potAmount(contribution: number, memberCount: number): number {
  return contribution * memberCount;
}
