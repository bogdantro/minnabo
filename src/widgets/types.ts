/**
 * What the «Nye oppdrag» home screen widget shows (asked 2026-11-09). The widget can't import anything, so
 * every word comes in here too, from nb.ts. Approximate place only (rule 6), never an address.
 */
export type NewOppdragWidgetProps = {
  /** «Nye oppdrag i Lillehammer» */
  heading: string;
  /** «3 nye siste uka» */
  sub: string;
  /** shown when there is nothing new */
  empty: string;
  items: { title: string; line: string }[];
};

/** The widget's name in app.json (expo-widgets plugin). */
export const NEW_OPPDRAG_WIDGET = 'NyeOppdrag';
