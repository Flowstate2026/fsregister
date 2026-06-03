/**
 * Parse a CSV date cell into ISO format (YYYY-MM-DD).
 * Accepts:
 *   - DD/MM/YYYY  (primary)
 *   - DD-MM-YYYY
 *   - YYYY-MM-DD  (passthrough)
 * Returns undefined if input is empty or unparseable.
 */
export function parseCsvDate(input?: string): string | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (!s) return undefined;

  // Already ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (also accepts D/M/YYYY)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return undefined;
}
