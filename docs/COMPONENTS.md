# MinNabo – component spec

Every visual element in `design/screens/*.dc.html` is built from classes in `design/screens/mn.css`.
This file maps each class to one React Native component. Build these ONCE in `src/components/ui/`
and use them everywhere. All values come from `src/theme/theme.ts`.

Global rules
- No gradients anywhere. Flat colours only.
- Minimum touch target 44×44 (`hitSlop` if the visual is smaller).
- Every icon-only button has `accessibilityLabel` (Norwegian).
- Entrance motion: lists stagger in with `FadeInDown` 16px, 550 ms, 50 ms between items.
- Put rotation/translation on an INNER view, never on the animated one.

## Where they live

All in `src/components/ui/`, exported from `@/components/ui`. Visual reference for every variant: `design/screens/Komponenter.dc.html`.

| File | Components |
|---|---|
| `Layout.tsx` | Screen, MainHeader, SubHeader, StickyFooter, FooterRow |
| `SectionHeader.tsx` | SectionHeader |
| `Button.tsx` · `IconButton.tsx` · `TextLink.tsx` | Button, IconButton, TextLink |
| `Pill.tsx` · `Badges.tsx` · `Chip.tsx` | Pill, CountBadge, VerifiedBadge, Stars, Chip, ChipRow |
| `Card.tsx` · `ListingCard.tsx` · `CategoryArt.tsx` · `Avatar.tsx` | Card, ListingCard, SaveButton, CategoryArt, Avatar |
| `List.tsx` | ListGroup, ListRow, KeyValueRow, StatTile |
| `Field.tsx` | Field, Input (= `<TextInput>`), AmountInput, SelectBox, ErrorText |
| `Controls.tsx` | Toggle, Checkbox, Radio, OptionCard |
| `Segmented.tsx` · `RangeSlider.tsx` · `Wizard.tsx` | Segmented, Tabs, RangeSlider, DayChips, StepProgress, PhotoAddTile (= `<PhotoPicker>` tile) |
| `Sheet.tsx` · `Dialog.tsx` · `../ToastHost.tsx` + `@/lib/toast` | Sheet, Dialog, Toast (`toast.success(text, { icon, action })`) |
| `Chat.tsx` | Bubble, SystemMessage, TypingIndicator, OfferCard, PaymentNote, Note |
| `Skeleton.tsx` · `States.tsx` · `Celebrate.tsx` | Skeleton (+ ListingCardSkeleton, RowSkeleton), EmptyState, ErrorState, SuccessState, NoAccess, DrawnCheck, Confetti |
| `Motion.tsx` | FadeUp (`.au`), FadeInView (`.ai`), ScaleIn (`.as`) – use these instead of Reanimated `entering` inside scroll views (web keeps those views absolutely positioned) |
| `Txt.tsx` · `Icon.tsx` · `PressableScale.tsx` · `Spinner.tsx` | typography (`theme.text`), icons (`theme.icons` keys), press-scale, spinner |

Shadows are CSS `boxShadow` strings (`theme.shadow`), rendered natively on iOS, Android (new architecture) and web.

---

## Layout

| CSS | RN component | Spec |
|---|---|---|
| `.phone` | `<Screen>` | bg `colors.bg` (`.phone.white` → `#FFF`). Handles safe area. |
| `.scroll` | `<Screen scroll>` → `ScrollView` | hidden indicators; bottom spacer 128 when nav visible (`.spacer-nav`), 140 when sticky footer (`.spacer-foot`). |
| `.px` | style | `paddingHorizontal: 20` |
| `.topbar` | `<MainHeader>` | Left: logo 34px + "MinNabo" (display 800, 21px, -0.03em). Right: bell `IconButton` (+ red dot) → Varsler, avatar 40 → Profil (`accessibilityLabel="Åpne profil"`). Top padding = safe inset + 10, bottom 10, horizontal 20. |
| `.subbar` | `<SubHeader title left right>` | 3 columns: 44 / flex / 44, gap 8, horizontal padding 16. Title Figtree 700 17px centred, 1 line ellipsis. Left = back `IconButton` (`accessibilityLabel="Tilbake"`). |
| `.nav` | `<TabBar>` (custom tabBar for expo-router Tabs) | Floating: left/right 12, bottom 16 (+ safe inset), height 74, radius 30, white 93% + `expo-blur`, `shadow.large`. 5 slots: Oppdrag, Fellesskap, **Legg ut (FAB)**, Innboks (badge), Meny. Item: icon 22 inside 48×32 pill; label 11px bold. Active: pill bg `limeTint`, icon+label `limeDeep`. Inactive: `mute`. Hidden on detail/chat/wizard screens. |
| `.fab` | `<PostButton>` | 62 circle, bg `lime`, plus icon 26 `ink`, white 5px ring, raised 30px above bar, label "Legg ut" below. Press: scale .9 + rotate 90°. Always opens the Legg ut wizard. |
| `.foot` | `<StickyFooter>` | Absolute bottom, padding 16/20/30, white 94% + blur, top border `line2`. Children stacked gap 10; button rows gap 10. |
| `.sh` | `<SectionHeader icon title subtitle action>` | margin 30 top / 14 bottom. Optional 34×34 icon tile radius 12. Title display 21. Subtitle meta 13. Action = `<TextLink>` "Se alle". |

## Buttons

`<Button variant size block icon loading disabled>` — height 52 (sm 40, lg 58), radius pill, padding 22 (sm 16, lg 26), label Figtree 700 16 (sm 14, lg 17), icon gap 9. Press: scale .97.

| variant | bg | text | extra |
|---|---|---|---|
| `lime` (primary) | `lime` | `ink` | shadow lime-ish soft |
| `cyan` (secondary action) | `cyan2` | white | |
| `ink` | `ink` | white | |
| `ghost` | white | `ink` | 1.5px `line` border |
| `soft` | `#EAEDF2` | `ink` | |
| `danger` | `danger` | white | |
| `dangerGhost` | white | `danger` | 1.5px `#F2C9C5` border |
| `vipps` | `vipps` | white | **login screen only** |
| `text` | none | `ink` | underlined, height 44 |

Disabled: opacity .38, no shadow. Loading: spinner 18px replaces icon, label changes (e.g. "Sender tilbudet …").

`<IconButton icon variant>` — 44 circle, white 90% + 1px `line`; `dark` = ink bg white icon; `glass` = white 82% + blur (over images). Optional red dot (10px, top 9 right 10, 2px white border).

`<TextLink>` — Figtree 700 14, `cyanDeep`, min height 44, optional trailing arrow icon 16.

## Pills, badges, chips

`<Pill tone size dot icon>` — height 26 (lg 32), padding 10 (lg 13), radius pill, Figtree 700 12.

| tone | bg | text | used for |
|---|---|---|---|
| `need` | `limeTint` | `limeDeep` | "Trenger hjelp", "Åpent oppdrag" (dot `limeDot` with 2px white ring) |
| `offer` | `cyanTint` | `cyanDeep` | cyan accents (roles, "Gi tilbud") |
| `neutral` | `#ECEFF3` | `ink2` | Dugnad, Gjentakende, category |
| `line` | white + border | `ink2` | "Endre" |
| `dark` | `ink` | white | "Ny", "Tilbud sendt" |
| `warn` | `warnTint` | `warn` | "Endring forespurt", "Venter på svar" |
| `ok` | `okTint` | `okText` | "Godtatt", "Aktiv", "Tilbud godtatt" |
| `danger` | `dangerTint` | `danger` | "Avslått" |

`<CountBadge>` — min 19×19, radius 10, bg `notifDot`, white 800 11, 2px white border.

`<Chip label icon category selected size>` — height 42 (sm 36), radius pill, white + 1px `line`, Figtree 600 14. With icon: 30px circle with category colours, padding-left 6. Selected: bg `ink`, text white, icon circle white 16%. Horizontal list: `ScrollView horizontal` padding 20, gap 8.

`<VerifiedBadge>` — `BadgeCheck` 14–16 + text, colour `#1B8F4E`, Figtree 700 12.5. Tappable → sheet explaining what was checked.

## Cards

`<Card>` — white, radius 22, `shadow.card`, hairline `rgba(10,23,64,.035)`. `flat` = no shadow, 1px `line`. `pad` = 18.

`<ListingCard>` (`.lcard`) — the most important component.
- Container: white, radius 24, padding 12, `shadow.card`, row gap 14. Press scale .985.
- Thumb: 96 wide, min 118 tall, radius 17 → `<CategoryArt>` (or real photo when available). Optional online dot.
- Body (gap 6): badge row (`Pill need` "Trenger hjelp" + optional neutral pill) → title Figtree 700 16, 1 line ellipsis, right padding 40 → owner row (bold name + star 14 `star` + rating) → pin row "Nordre Ål · 1,2 km" → clock row (schedule) → price row at bottom: label 12 `mute` ("Budsjett"/empty) + value display 19 ("400 kr" / "Ønsker tilbud").
- Meta rows: 13px `mute`, icons 14 `faint`, 1 line.
- Save button absolute top 10 right 10: 38 circle bg `bg`; saved = bg `#FDECEC`, heart filled `#E5484D`, pop animation (scale 1→1.4→1). Tapping save must NOT open the card. Shows toast "Lagret i Lagrede" + "Angre".

`<CategoryArt category size radius>` — flat bg + centred Lucide icon (34px, category `fg`). Used wherever there is no photo.

`<Avatar initials colorKey size ring online>` — circle, initials Figtree 700 (size×0.35). Ring = 2px white + 2px `cyan` (outer). Online dot 12px `online` with 2px white border, bottom-right. Current user uses `me` colours.

`<StatTile value label>` — flex 1, padding 14, radius 18, white + shadow; value display 22, label 12.5 `mute`.

## Lists

`<ListGroup>` (`.list`) — white, radius 22, shadow, overflow hidden.
`<ListRow icon title subtitle right href>` (`.lrow`) — min height 60, padding 13/16, gap 14. Icon tile 40×40 radius 13 bg `bg`. Title Figtree 600 15.5, subtitle 13 `mute`. Divider 1px `line2` starting at x=68. Chevron `faint`.
`<KeyValueRow label value>` (`.kv`) — padding 12, border-bottom `line2`, label `mute`, value bold right-aligned.

## Forms

`<Field label hint error>` — label Figtree 700 14 (+ small grey hint on right), gap 8.
`<TextInput>` — height 56, radius 17, white, 1.5px `line`, padding 16, Figtree 500 16. Focus: border `cyan2` + 4px ring `rgba(25,184,238,.16)`. Error: border `danger` + ring `rgba(194,48,41,.1)` + `<ErrorText>` (600 13 `danger`, alert icon, shake animation).
Multiline: min height 112, padding 14/16, line height 1.5, counter "12/500" in label hint.
`<AmountInput>` — height 76, display 700 34, suffix "kr" right 16 bold `mute`. Numeric keyboard. Norwegian thousands spacing "1 250".
`<SelectBox>` — looks like input, value + chevron, opens a `<Sheet>` picker.
`<Toggle value>` — 52×32, off `toggleOff`, on `toggleOn`, knob 26 white, spring slide 20px.
`<Checkbox checked>` — 26 square radius 8, 2px `#C3C9D4`; checked bg `ink`, check icon `lime` pops in.
`<Radio selected>` — 24 circle, 2px border; selected = 7px `ink` border.
`<OptionCard selected>` (`.optcard`) — row, padding 16, radius 20, 1.5px `line`; selected border `ink` + 3px ring `rgba(10,23,64,.08)`.
`<Segmented options value>` — bg `#E6E9EE`, radius pill, padding 4, gap 4; items height 40 Figtree 700 14 `ink2`; active white + small shadow, `ink`.
`<Tabs>` (underline) — gap 22, height 46, Figtree 700 15; active `ink` with 3px bottom bar that grows in.
`<RangeSlider>` — track 6px, filled `ink`, thumb 28 white with 3px `ink` border.
`<DayChips>` — horizontal, items height 44–46, radius 14, 1.5px border; selected `ink` bg white text.
`<PhotoPicker>` — dashed 2px `#C9CFD9` tile radius 18 "Legg til bilde".
`<StepProgress step total>` — 6px track `#E1E5EA`, fill `lime`, animates width 500 ms. Header text "Steg 3 av 9".

## Overlays

`<Sheet>` (`@gorhom/bottom-sheet`) — radius 32 top, padding 10/20/34, grabber 42×5 `#D6DAE1`, header row (title h2/h3 + close IconButton). Backdrop `scrim`, tap closes. Enter 450 ms ease. Max 90% height.
`<Dialog>` — centred, left/right 24, radius 28, padding 26/22/20, centred text, spring scale-in. Two buttons side by side.
`<Toast message icon action>` — bottom 108 above tab bar (30 when no bar), left/right 16, bg `ink`, radius 18, white 600 14.5. Leading 28 circle `lime` with icon. Optional action "Angre" in `lime`. Auto-hide 2.6 s.

## Chat

`<Bubble incoming|outgoing>` — max 78%, padding 11/15, radius 22 with 7px on the tail corner. Incoming: white + 1px `line`. Outgoing: `ink` bg, white text. Time 11.5 `faint` + status icon (Check → CheckCheck → CheckCheck `cyan` when read).
`<SystemMessage>` — centred pill, white + border, 600 13 `ink2`.
`<TypingIndicator>` — 3 dots 7px `#A3AABB`, bounce 1.2 s staggered 150 ms.
`<OfferCard>` — see Chat.dc.html: header "Tilbud", price display large, date/duration, description, Forbehold, payment disclaimer, actions "Avslå" (ghost) / "Godta tilbud" (lime) for the recipient. Accepted state: green header "Tilbud godtatt", lock icon, "Avtalegrunnlaget er låst".
`<PaymentNote>` — `Info` icon 15 + "Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling." 12.5 `mute`. **Must appear near every price/offer.**

## States

`<Skeleton>` — bg `#E6E9EE`, radius 10, opacity pulse 1 → .45 → 1 over 1.3 s (no shimmer gradient).
`<EmptyState illustration title body action>` / `<ErrorState>` / `<OfflineBanner>` / `<SuccessState>` / `<NoAccess>` — see `Tilstander.dc.html`. Illustration = two soft tinted circles + white 80×80 rounded tile (radius 26) with a 32px icon.
`<DrawnCheck>` — `react-native-svg` path `M5 12.5 10 17.5 19.5 7`, stroke 2.6 `ink`, animate strokeDashoffset 60→0 over 600 ms after 250 ms, inside a 104–120 `lime` circle with a 10–12px `limeTint` ring.
`<Confetti>` — 7 small rectangles (lime, cyan, ink, star) falling 520px with rotation over 2.4 s.
