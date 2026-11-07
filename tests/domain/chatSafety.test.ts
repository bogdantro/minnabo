import { isOwnLink, scamSignals, shareWarning, splitMessage } from '@/domain/chatSafety';

test('a link and a phone number are found in a sentence', () => {
  const parts = splitMessage('Se finn.no/123 eller ring 912 34 567.');
  expect(parts.map((p) => p.kind)).toEqual(['text', 'link', 'text', 'phone', 'text']);
  expect(parts[1]).toMatchObject({ url: 'https://finn.no/123' });
  expect(parts[3]).toMatchObject({ tel: '91234567' });
});

test('a missing space after a full stop is not a link', () => {
  expect(splitMessage('Hei på hytta.Har du tid? N.Nordmann').every((p) => p.kind === 'text')).toBe(true);
});

test('a price and a year are not phone numbers', () => {
  expect(splitMessage('Det koster 1500 kr i 2026').every((p) => p.kind === 'text')).toBe(true);
});

test('a full stop after a link is not part of it', () => {
  expect(splitMessage('Se https://vg.no.')[1]).toMatchObject({ text: 'https://vg.no' });
});

test('a lookalike domain is not ours', () => {
  expect(isOwnLink('https://minnaboapp.no/hjelp')).toBe(true);
  expect(isOwnLink('https://www.minnaboapp.no')).toBe(true);
  expect(isOwnLink('https://minnaboapp.no.svindel.ru')).toBe(false);
});

test('asking for money up front is flagged before an avtale', () => {
  expect(scamSignals('Du må betale på forhånd', false)).toContain('MONEY');
  expect(scamSignals('Jeg vil ha forskudd', false)).toContain('MONEY');
});

test('an account number and a BankID code are flagged', () => {
  expect(scamSignals('Kontonummer 1234.56.78903', false)).toContain('ACCOUNT');
  expect(scamSignals('Send meg BankID og engangskode', false)).toContain('CODES');
});

test('nothing is flagged once there is an avtale', () => {
  expect(scamSignals('Du må betale på forhånd', true)).toEqual([]);
});

test('a normal message is left alone', () => {
  expect(scamSignals('Hei! Jeg kan komme lørdag kl. 10.', false)).toEqual([]);
});

test('an address or phone number typed too early gives a warning', () => {
  expect(shareWarning('Jeg bor i Storgata 12', false)).toBe('ADDRESS');
  expect(shareWarning('Ring meg på 91234567', false)).toBe('PHONE');
});

test('after an avtale the address is what you are meant to share', () => {
  expect(shareWarning('Jeg bor i Storgata 12', true)).toBeNull();
});
