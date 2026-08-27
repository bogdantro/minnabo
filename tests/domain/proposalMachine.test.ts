import { transition, canTransition } from '@/domain/proposalMachine';

test('proposer sends a draft', () => {
  expect(transition('DRAFT', 'SEND', 'PROPOSER')).toBe('SENT');
});

test('recipient accepts a sent proposal', () => {
  expect(transition('SENT', 'ACCEPT', 'RECIPIENT')).toBe('ACCEPTED');
});

test('proposer cannot accept their own proposal', () => {
  expect(canTransition('SENT', 'ACCEPT', 'PROPOSER')).toBe(false);
  expect(() => transition('SENT', 'ACCEPT', 'PROPOSER')).toThrow('Ugyldig endring av tilbudet.');
});

test('revision round trip', () => {
  expect(transition('ACCEPTED', 'REQUEST_REVISION', 'RECIPIENT')).toBe('REVISION_PENDING');
  expect(transition('REVISION_PENDING', 'CONFIRM_REVISION', 'PROPOSER')).toBe('ACCEPTED');
});

test('cannot withdraw after acceptance', () => {
  expect(canTransition('ACCEPTED', 'WITHDRAW', 'PROPOSER')).toBe(false);
});
