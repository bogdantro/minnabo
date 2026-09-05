import { repositories } from '@/data/repositories';

beforeEach(() => repositories.listings._reset());

describe('municipalities filter', () => {
  it('with no municipalities set, all seed listings are returned', () => {
    const all = repositories.listings.list();
    expect(all.length).toBeGreaterThan(0);
  });

  it('restricts results to the given kommuner', () => {
    const scoped = repositories.listings.list({ municipalities: ['Gjøvik'] });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((l) => l.location.municipality === 'Gjøvik')).toBe(true);
  });

  it('an empty array means no filtering', () => {
    const a = repositories.listings.list({ municipalities: [] });
    const b = repositories.listings.list();
    expect(a.length).toBe(b.length);
  });
});
