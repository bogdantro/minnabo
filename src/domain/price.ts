export type Price = { amountMinor: number; currency: 'NOK' };

export const nok = (kroner: number): Price => ({
  amountMinor: Math.round(kroner * 100),
  currency: 'NOK',
});

/** Non-breaking space, so "1 500 kr" never wraps between the digits. */
export const NBSP = ' ';

/** Group thousands with a non-breaking space: 1500 -> "1<nbsp>500". */
export const groupThousands = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

export const formatPrice = (p: Price): string =>
  `${groupThousands(Math.round(p.amountMinor / 100))}${NBSP}kr`;

/** "300 kr / t" */
export const formatHourly = (p: Price): string => `${formatPrice(p)}${NBSP}/${NBSP}t`;

export const formatFromPrice = (p: Price): string => `Fra${NBSP}${formatPrice(p)}`;
