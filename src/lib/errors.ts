/**
 * Which error texts may be shown to the person as they are.
 *
 *  * UserError – written for people, in Norwegian: our own `raise exception` messages from
 *    the database (marked by the API client, see backendError) and the app's own messages
 *    (e.g. «MinNabo trenger tilgang til bildene dine.»).
 *  * everything else – network errors, Postgres' own refusals, library errors – is English
 *    or technical, so the screen shows its own friendly fallback instead.
 *
 * Screens always go through serverMessage(), never `e.message` directly.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

/** The word filter and spam limits (0053 and earlier), also when they come as a plain Error. */
const FOR_THE_USER = /tillatt på MinNabo|^For mange |mange oppdrag|mange oppslag/;

/**
 * Postgres error codes our migrations raise with a Norwegian message: P0001 is the default
 * for `raise exception`, 42501 is used by the youth limits (0038). 42501 is also Postgres'
 * own "permission denied" / row-level-security refusal, which is English and stays hidden.
 */
const OUR_CODES = new Set(['P0001', '42501']);
const POSTGRES_OWN = /^(new row violates|permission denied|insufficient_privilege)/i;
/** Internal markers raised for code, not for people (e.g. HOVEDPARTNER_FULL, not authenticated). */
const INTERNAL = /^[A-Z0-9_]+$|^not authenticated$/;

/** A Supabase / PostgREST error as an Error – a UserError when the text was written for people. */
export function backendError(err: { message?: string; code?: string } | string | null | undefined): Error {
  if (typeof err === 'string') return new UserError(err);
  const message = err?.message || 'Noe gikk galt. Prøv igjen.';
  const ours = !!err?.code && OUR_CODES.has(err.code) && !POSTGRES_OWN.test(message) && !INTERNAL.test(message);
  return ours ? new UserError(message) : new Error(message);
}

export function serverMessage(e: unknown, fallback: string): string {
  if (e instanceof UserError) return e.message;
  const m = e instanceof Error ? e.message : '';
  return FOR_THE_USER.test(m) ? m : fallback;
}
