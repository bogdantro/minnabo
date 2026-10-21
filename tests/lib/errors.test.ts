import { UserError, backendError, serverMessage } from '@/lib/errors';

test('the word filter and spam limits are shown as the server wrote them', () => {
  for (const m of [
    'Teksten inneholder ord som ikke er tillatt på MinNabo.',
    'For mange oppdrag på kort tid. Vent litt og prøv igjen.',
    'Du har lagt ut mange oppdrag i dag. Prøv igjen i morgen.',
    'Du har lagt ut mange oppslag i dag. Prøv igjen i morgen.',
    'For mange tilbud. Vent litt og prøv igjen.',
  ]) {
    expect(serverMessage(new Error(m), 'Noe gikk galt')).toBe(m);
  }
});

test('anything else gets the fallback', () => {
  expect(serverMessage(new Error('duplicate key value violates unique constraint'), 'Noe gikk galt')).toBe('Noe gikk galt');
  expect(serverMessage(undefined, 'Noe gikk galt')).toBe('Noe gikk galt');
});

test('our own database messages are shown as written – technical ones never are', () => {
  const shown = (message: string, code: string) => serverMessage(backendError({ message, code }), 'Noe gikk galt');
  // `raise exception` in our migrations (P0001), and the youth limits (42501)
  expect(shown('Gi et tilbud først – da kan dere skrive sammen.', '42501')).toBe('Gi et tilbud først – da kan dere skrive sammen.');
  expect(shown('Dette er ikke tilgjengelig for ungdomskontoer.', '42501')).toBe('Dette er ikke tilgjengelig for ungdomskontoer.');
  expect(shown('Visningsnavnet må være navnet ditt fra Vipps eller en kortform av det.', 'P0001')).toBe(
    'Visningsnavnet må være navnet ditt fra Vipps eller en kortform av det.',
  );
  // Postgres' own refusals and our internal codes stay hidden
  expect(shown('new row violates row-level security policy for table "listings"', '42501')).toBe('Noe gikk galt');
  expect(shown('permission denied for table profiles', '42501')).toBe('Noe gikk galt');
  expect(shown('HOVEDPARTNER_FULL', 'P0001')).toBe('Noe gikk galt');
  expect(shown('not authenticated', 'P0001')).toBe('Noe gikk galt');
  expect(shown('duplicate key value violates unique constraint "x"', '23505')).toBe('Noe gikk galt');
});

test('messages the app itself writes for people are shown, network errors are not', () => {
  expect(serverMessage(new UserError('MinNabo trenger tilgang til bildene dine.'), 'Noe gikk galt')).toBe('MinNabo trenger tilgang til bildene dine.');
  expect(serverMessage(new Error('Network request failed'), 'Noe gikk galt')).toBe('Noe gikk galt');
});
