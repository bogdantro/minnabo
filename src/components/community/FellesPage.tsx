import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FadeUp, Icon, Screen, StickyFooter, SubHeader, type IconName } from '@/components/ui';

/** The look of the Fellesskap pages (0108): a flat tint, a disc with an icon, and a dashed ring. */
export type FellesTone = { bg: string; fg: string; blob: string };

export const TONES = {
  lime: { bg: colors.surface, fg: colors.limeDeep, blob: colors.limeTint },
  cyan: { bg: colors.surface, fg: colors.cyanDeep, blob: colors.cyanTint },
  heart: { bg: colors.surface, fg: colors.heart, blob: colors.savedBg },
  lavender: { bg: colors.surface, fg: colors.lavender, blob: colors.lavenderTint },
  ok: { bg: colors.surface, fg: colors.okText, blob: colors.okTint },
  warn: { bg: colors.surface, fg: colors.warn, blob: colors.warnTint },
} satisfies Record<string, FellesTone>;

/**
 * A Fellesskap sub-page: back header, a hero card with eyebrow, title and lead, then the content.
 * `footer` is pinned under the scroll (a main button).
 */
export function FellesPage({
  title,
  eyebrow,
  lead,
  icon,
  tone = TONES.lime,
  children,
  footer,
  testID,
}: {
  title: string;
  eyebrow?: string;
  lead?: string;
  icon: IconName;
  tone?: FellesTone;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const router = useRouter();
  return (
    <Screen
      scroll
      spacer={footer ? 'foot' : 'none'}
      footer={footer ? <StickyFooter>{footer}</StickyFooter> : undefined}
      header={<SubHeader title={title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/fellesskap'))} />}
    >
      <FadeUp style={styles.px}>
        <View style={[styles.hero, { backgroundColor: tone.bg }, shadow.card]} testID={testID}>
          <View style={[styles.blob, { backgroundColor: tone.blob }]} />
          <View style={[styles.ring, { borderColor: tone.fg }]} />
          <View style={[styles.disc, { backgroundColor: tone.blob }]}>
            <Icon name={icon} size={24} color={tone.fg} />
          </View>
          {eyebrow ? <Text style={[text.eyebrow, { color: tone.fg }]}>{eyebrow}</Text> : null}
          <Text style={[text.h1, styles.title]} accessibilityRole="header">
            {title}
          </Text>
          {lead ? <Text style={[text.body, styles.lead]}>{lead}</Text> : null}
        </View>
      </FadeUp>
      <View style={styles.body}>{children}</View>
    </Screen>
  );
}

/** A plain section label inside a Fellesskap page. */
export function PageLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{children}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  hero: { marginTop: 10, padding: 20, borderRadius: radius.card, overflow: 'hidden', gap: 6 },
  blob: { position: 'absolute', right: -40, top: -50, width: 170, height: 170, borderRadius: 85 },
  ring: { position: 'absolute', right: 24, top: 18, width: 74, height: 74, borderRadius: 37, borderWidth: 1.5, borderStyle: 'dashed', opacity: 0.5 },
  disc: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  // long Norwegian words («Nabolagsprosjekter») must fit on one line
  title: { fontSize: 29, lineHeight: 33, letterSpacing: -0.6 },
  lead: { color: colors.ink2 },
  body: { paddingHorizontal: screenPadding, paddingTop: 18, paddingBottom: 40, gap: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  label: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, color: colors.ink },
});
