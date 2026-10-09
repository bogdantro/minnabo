/**
 * Some refusals from the backend are meant for the person: the word filter and
 * the spam limits (migration 0053 and earlier). Those texts are shown as they
 * are; everything else gets the screen's own fallback.
 */
const FOR_THE_USER = /tillatt på MinNabo|^For mange |mange oppdrag|mange oppslag/;

export function serverMessage(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : '';
  return FOR_THE_USER.test(m) ? m : fallback;
}
