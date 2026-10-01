import {
  INNLANDET_KOMMUNER,
  resolveKommune,
  expandKommuner,
} from '@/data/kommuner';

describe('resolveKommune', () => {
  it('returns a canonical kommune unchanged', () => {
    expect(resolveKommune('Lillehammer')).toBe('Lillehammer');
  });
  it('is case- and whitespace-insensitive', () => {
    expect(resolveKommune('  lillehammer ')).toBe('Lillehammer');
  });
  it('maps a poststed/by alias to its kommune', () => {
    expect(resolveKommune('Brumunddal')).toBe('Ringsaker');
    expect(resolveKommune('Moelv')).toBe('Ringsaker');
    expect(resolveKommune('Raufoss')).toBe('Vestre Toten');
  });
  it('maps a 4-digit postnummer to its kommune', () => {
    expect(resolveKommune('2380')).toBe('Ringsaker');
    expect(resolveKommune('2615')).toBe('Lillehammer');
  });
  it('returns undefined for something unrecognised', () => {
    expect(resolveKommune('Atlantis')).toBeUndefined();
    expect(resolveKommune('')).toBeUndefined();
  });
});

describe('expandKommuner', () => {
  it('reach 0 is just the base kommune', () => {
    expect(expandKommuner('Lillehammer', 0)).toEqual(['Lillehammer']);
  });
  it('reach 1 adds direct neighbours (deduped, base first)', () => {
    const r = expandKommuner('Lillehammer', 1);
    expect(r[0]).toBe('Lillehammer');
    expect(r).toEqual(expect.arrayContaining(['Øyer', 'Gausdal']));
    expect(new Set(r).size).toBe(r.length);
  });
  it('reach 2 is a superset of reach 1', () => {
    const r1 = expandKommuner('Lillehammer', 1);
    const r2 = expandKommuner('Lillehammer', 2);
    expect(r2).toEqual(expect.arrayContaining(r1));
    expect(r2.length).toBeGreaterThanOrEqual(r1.length);
  });
  it('reach 2 is all of Innlandet ("Hele Innlandet" in the design)', () => {
    const r2 = expandKommuner('Lillehammer', 2);
    expect(r2[0]).toBe('Lillehammer');
    expect(r2).toHaveLength(INNLANDET_KOMMUNER.length);
    expect(r2).toEqual(expect.arrayContaining([...INNLANDET_KOMMUNER]));
  });
  it('returns [] when base is undefined', () => {
    expect(expandKommuner(undefined, 2)).toEqual([]);
  });
  it('unknown base: reach 1 is [base], reach 2 is base + region-wide', () => {
    expect(expandKommuner('Atlantis', 1)).toEqual(['Atlantis']);
    const r2 = expandKommuner('Atlantis', 2);
    // the base is always present in the result, even when it isn't canonical
    expect(r2[0]).toBe('Atlantis');
    expect(r2).toEqual(expect.arrayContaining([...INNLANDET_KOMMUNER]));
    expect(new Set(r2).size).toBe(r2.length);
  });

  it('unknown base that IS canonical stays present exactly once at reach 2', () => {
    const r2 = expandKommuner('Trysil', 2); // canonical, but no neighbours entry
    expect(r2[0]).toBe('Trysil');
    expect(r2.filter((k) => k === 'Trysil')).toHaveLength(1);
    expect(r2).toEqual(expect.arrayContaining([...INNLANDET_KOMMUNER]));
  });
});
