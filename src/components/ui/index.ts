// Redesign component library (docs/COMPONENTS.md). Values come from src/theme/theme.ts.
export { Txt } from './Txt';
export type { TxtProps, TxtVariant, TxtColor } from './Txt';
export { Icon } from './Icon';
export type { IconName, IconKey, IconProps } from './Icon';
export { PressableScale } from './PressableScale';
export { Spinner } from './Spinner';

// layout
export { Screen, MainHeader, SubHeader, StickyFooter, FooterRow } from './Layout';
export type { ScreenProps, MainHeaderProps, SubHeaderProps } from './Layout';
export { SectionHeader } from './SectionHeader';
export type { SectionHeaderProps } from './SectionHeader';

// buttons
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { IconButton } from './IconButton';
export type { IconButtonProps, IconButtonVariant } from './IconButton';
export { TextLink } from './TextLink';
export type { TextLinkProps } from './TextLink';

// pills, badges, chips
export { Pill } from './Pill';
export type { PillProps, PillTone } from './Pill';
export { CountBadge, VerifiedBadge, VerifiedIcon, Stars } from './Badges';
export { Chip, ChipRow } from './Chip';
export type { ChipProps } from './Chip';

// cards
export { Card } from './Card';
export type { CardProps } from './Card';
export { ListingCard, SaveButton } from './ListingCard';
export type { ListingCardProps } from './ListingCard';
export { CategoryArt } from './CategoryArt';
export { Avatar, avatarColorFor } from './Avatar';
export type { AvatarProps } from './Avatar';

// lists
export { ListGroup, ListRow, KeyValueRow, StatTile } from './List';
export type { ListRowProps } from './List';

// forms
export { Field, Input, AmountInput, SelectBox, ErrorText, formatAmount } from './Field';
export type { FieldProps, InputProps, AmountInputProps, SelectBoxProps } from './Field';
export { Toggle, Checkbox, Radio, OptionCard } from './Controls';
export type { ToggleProps, CheckboxProps, OptionCardProps } from './Controls';
export { Segmented, Tabs } from './Segmented';
export type { SegmentOption, SegmentedProps, TabsProps } from './Segmented';
export { RangeSlider } from './RangeSlider';
export { GrowBar } from './Bar';
export { DayChips, StepProgress, PhotoAddTile } from './Wizard';
export type { DayChip } from './Wizard';

// overlays
export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';
export { Dialog } from './Dialog';
export type { DialogProps } from './Dialog';

// chat
export { Bubble, SystemMessage, TypingIndicator, OfferCard, PaymentNote, Note, PAYMENT_NOTE } from './Chat';
export type { BubbleProps, OfferCardProps, OfferCardState } from './Chat';

// states
export { Skeleton, ListingCardSkeleton, ListingListSkeleton, RowSkeleton } from './Skeleton';
export { StateView, StateIllustration, EmptyState, ErrorState, NoAccess, SuccessState } from './States';
export { DrawnCheck, Confetti } from './Celebrate';
export { FadeUp, FadeInView, ScaleIn, SlideIn, Shake } from './Motion';
export { ScreenState } from './ScreenState';
export type { ScreenStateProps, ScreenStatus } from './ScreenState';

// legacy (pre-redesign) – remove as screens are rebuilt
export { AppText } from './Text';
export type { AppTextProps } from './Text';
export { StatusPill } from './StatusPill';
export type { StatusPillProps } from './StatusPill';
export { SearchField } from './SearchField';
export type { SearchFieldProps } from './SearchField';
