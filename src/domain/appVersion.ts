/** "1.2.3" → [1, 2, 3]. Anything odd counts as 0, so a typo on the website never stops anyone. */
const parts = (v: string) => v.split('.').map((p) => parseInt(p, 10) || 0);

/** Is `current` older than `minimum`? */
export function isOlderVersion(current: string, minimum: string): boolean {
  const a = parts(current);
  const b = parts(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
