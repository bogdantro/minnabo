// Redesign tokens: `import { theme, colors, text, … } from '@/theme'`.
export * from './theme';
export { tokens } from './tokens';
export type { ColorToken, TextVariant, FontWeight } from './tokens';
export { categoryAccent } from './categoryAccent';
export type { CategoryAccent } from './categoryAccent';

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
