import { nearFirst, townLabel, townOf } from '@/lib/places';

const HOUR = 60 * 60 * 1000;
const job = (id: string, place: string, urgentUntil?: string) => ({ id, location: { municipality: 'Ringsaker', place }, urgentUntil });

describe('towns inside a kommune', () => {
  test('a town is named with its kommune; the kommune alone keeps «kommune»', () => {
    expect(townLabel('Moelv', 'Ringsaker')).toBe('Moelv · Ringsaker');
    expect(townLabel('Ringsaker', 'Ringsaker')).toBe('Ringsaker kommune');
    expect(townLabel('Hele kommunen', 'Ringsaker')).toBe('Ringsaker kommune');
    expect(townLabel(undefined, 'Ringsaker')).toBe('Ringsaker kommune');
  });

  test('the kommune name is not a town, whatever its case or spaces', () => {
    expect(townOf(' ringsaker ', 'Ringsaker')).toBeUndefined();
    expect(townOf('Brumunddal', 'Ringsaker')).toBe('Brumunddal');
    expect(townOf('  ', 'Ringsaker')).toBeUndefined();
  });

  test('my town first, the rest of the kommune after, each in the order it came', () => {
    const list = [job('a', 'Brumunddal'), job('b', 'Moelv'), job('c', 'Nes'), job('d', 'moelv')];
    expect(nearFirst(list, 'Moelv').map((j) => j.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  test('a hasteoppdrag elsewhere still stays on top', () => {
    const now = 1000 * HOUR;
    const list = [job('a', 'Moelv'), job('haste', 'Brumunddal', new Date(now + HOUR).toISOString()), job('b', 'Nes')];
    expect(nearFirst(list, 'Moelv', now).map((j) => j.id)).toEqual(['haste', 'a', 'b']);
  });

  test('without a town nothing moves', () => {
    const list = [job('a', 'Brumunddal'), job('b', 'Moelv')];
    expect(nearFirst(list, undefined)).toBe(list);
  });
});
