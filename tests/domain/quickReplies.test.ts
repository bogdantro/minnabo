import { quickReplies, replyStage } from '@/domain/quickReplies';
import type { AgreementSnapshot } from '@/domain/types';

const now = new Date(2026, 9, 31, 10, 0);
const agreement = (at: Date | null, extra: Partial<AgreementSnapshot> = {}) =>
  ({ scheduledAt: at?.toISOString(), ...extra }) as AgreementSnapshot;

describe('replyStage', () => {
  it('is «before» without an avtale, or when it was called off', () => {
    expect(replyStage(null, false, now)).toBe('before');
    expect(replyStage(agreement(new Date(2026, 10, 2, 14, 0), { cancelledAt: now.toISOString() }), false, now)).toBe('before');
  });

  it('follows the agreed time: another day, the job day, and 6 hours after', () => {
    expect(replyStage(agreement(new Date(2026, 10, 2, 14, 0)), false, now)).toBe('agreed');
    expect(replyStage(agreement(new Date(2026, 9, 31, 14, 0)), false, now)).toBe('jobDay');
    expect(replyStage(agreement(new Date(2026, 9, 31, 3, 0)), false, now)).toBe('after');
    expect(replyStage(agreement(null), false, now)).toBe('agreed');
  });

  it('is «after» as soon as the job is marked done', () => {
    expect(replyStage(agreement(new Date(2026, 10, 2, 14, 0)), true, now)).toBe('after');
  });
});

describe('quickReplies', () => {
  it('gives the helper and the owner different replies', () => {
    expect(quickReplies('jobDay', true)).toContain('Er på vei!');
    expect(quickReplies('jobDay', false)).not.toContain('Er på vei!');
    expect(quickReplies('after', false)).toContain('Takk for jobben!');
  });

  it('asks about the agreed time by the clock', () => {
    expect(quickReplies('agreed', false, new Date(2026, 10, 2, 14, 0).toISOString())[0]).toBe('Passer det fortsatt kl. 14:00?');
    expect(quickReplies('agreed', true)[0]).toBe('Passer tidspunktet fortsatt?');
  });
});
