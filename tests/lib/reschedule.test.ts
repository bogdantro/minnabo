import { rescheduleSuggestions } from '@/lib/reschedule';

describe('rescheduleSuggestions', () => {
  const now = new Date(2026, 9, 31, 9, 0); // lør 31. okt 09:00

  it('keeps the agreed time of day for tomorrow, in two days and next week', () => {
    const agreed = new Date(2026, 9, 31, 14, 30).toISOString();
    const out = rescheduleSuggestions(agreed, now);
    expect(out.map((s) => s.label)).toEqual(['I morgen samme tid', 'Om to dager samme tid', 'Samme tid neste uke']);
    const days = out.map((s) => new Date(s.iso));
    expect(days.map((d) => d.getDate())).toEqual([1, 2, 7]);
    days.forEach((d) => expect([d.getHours(), d.getMinutes()]).toEqual([14, 30]));
    expect(out[0].when).toMatch(/kl\. 14:30$/);
  });

  it('counts from today when the agreed time has already passed', () => {
    const agreed = new Date(2026, 9, 20, 10, 0).toISOString();
    const out = rescheduleSuggestions(agreed, now);
    expect(new Date(out[0].iso).getDate()).toBe(1);
  });

  it('gives no suggestions without an agreed time', () => {
    expect(rescheduleSuggestions(undefined, now)).toEqual([]);
    expect(rescheduleSuggestions('not a date', now)).toEqual([]);
  });
});
