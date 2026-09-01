/**
 * A stable, believable "neighbours already here" number for a place name.
 * Deterministic so it doesn't flicker as the user types, and bounded to a
 * range that reads as a real local community rather than a global counter.
 */
export function neighbourCountFor(place: string): number {
  const key = place.trim().toLowerCase();
  if (key.length < 2) return 0;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return 18 + (hash % 120); // 18–137
}
