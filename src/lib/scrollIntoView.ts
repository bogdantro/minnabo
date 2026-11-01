/**
 * Scroll a ScrollView so that `target` (any view inside `container`, however deeply nested)
 * is in view, with a little room above it. Used to bring the first form error into view.
 * Does nothing where measuring isn't available (tests, a view that has unmounted).
 */
type Measurable = { measureLayout?: (relativeTo: never, onSuccess: (x: number, y: number) => void, onFail?: () => void) => void };
type Scrollable = { scrollTo: (o: { y: number; animated?: boolean }) => void };

/** Room left above the field, so its label shows too. */
export const ERROR_SCROLL_MARGIN = 24;

export function scrollIntoView(target: unknown, container: unknown, scroll: Scrollable | null | undefined, margin = ERROR_SCROLL_MARGIN): void {
  const t = target as Measurable | null | undefined;
  if (!t?.measureLayout || !container || !scroll) return;
  t.measureLayout(
    container as never,
    (_x, y) => scroll.scrollTo({ y: Math.max(0, y - margin), animated: true }),
    () => undefined,
  );
}
