/** Banker ID issued by server — random, not guessable (e.g. BK1A2B3C4D5E6F7...) */
export function isValidBankerId(id: string): boolean {
  const trimmed = id.trim();
  if (!trimmed || trimmed.includes(':')) return false;
  return /^[A-Za-z0-9_-]{12,48}$/.test(trimmed);
}
