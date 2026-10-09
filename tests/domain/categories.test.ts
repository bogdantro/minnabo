import { CATEGORIES, categoryArtId, categoryBySlug, slugForArtId } from '@/domain/categories';
import { categoryColors, categoryLabels } from '@/theme/theme';

// The category list and its mapping to the design's category ids were rebuilt by
// hand once; these checks pin the two against the theme and against each other.
test('every category maps to a design category with the same label, colours and a way back', () => {
  for (const c of CATEGORIES) {
    const art = categoryArtId(c.slug);
    expect(categoryLabels[art]).toBe(c.label);
    expect(categoryColors[art]).toBeTruthy();
    expect(slugForArtId(art)).toBe(c.slug);
  }
});

test('every design category has a listing category, and unknown slugs fall back to Annet', () => {
  const arts = CATEGORIES.map((c) => categoryArtId(c.slug));
  expect(new Set(arts).size).toBe(CATEGORIES.length);
  expect(Object.keys(categoryLabels).sort()).toEqual([...arts].sort());
  expect(categoryBySlug('finnes-ikke').slug).toBe('annet');
});
