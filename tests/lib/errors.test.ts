import { serverMessage } from '@/lib/errors';

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
