import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { useAgreedSum } from '@/api/queries';
import { formatPrice, groupThousands, nok } from '@/domain/price';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { ErrorState, FadeUp, Icon, Note, PaymentNote, RowSkeleton, Screen, SubHeader } from '@/components/ui';

/** Skatteetaten's limit per private household per year. */
const TAX_FREE_KR = 6000;

const kr = (minor: number) => formatPrice({ amountMinor: minor, currency: 'NOK' });

/**
 * «Avtalt sum i år»: what a helper has agreed on finished jobs, per oppdragsgiver. Agreed prices
 * only: MinNabo never sees what was actually paid (rule 4), and that's what this screen says.
 */
export function AgreedSumScreen({ year }: { year: number }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useAgreedSum(year);
  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.agreedSum.title(year)} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}>
      <View style={styles.px}>
        {isLoading ? (
          <RowSkeleton />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : data ? (
          <>
            <FadeUp style={[styles.hero, shadow.hero]}>
              <View style={styles.glow} />
              <Text style={[text.eyebrow, styles.heroLabel]}>{nb.agreedSum.total}</Text>
              <Text style={styles.heroValue}>{formatPrice(nok(data.totalMinor / 100))}</Text>
              <Text style={styles.heroSub}>{nb.agreedSum.jobs(data.jobs)}</Text>
            </FadeUp>

            <FadeUp delay={80} style={styles.mt16}>
              <Text style={[text.eyebrow, styles.mb8]}>{nb.agreedSum.perPerson}</Text>
              {data.people.length ? (
                <View style={[styles.card, shadow.card]}>
                  {data.people.map((p, i) => {
                    const over = p.minor / 100 > TAX_FREE_KR;
                    const share = Math.min(1, p.minor / 100 / TAX_FREE_KR);
                    return (
                      <View key={`${p.name}${i}`} style={[styles.row, i > 0 && styles.divider]}>
                        <View style={styles.rowHead}>
                          <Text style={[text.label, styles.flex]} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={[text.num, styles.f17]}>{kr(p.minor)}</Text>
                        </View>
                        <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no">
                          <View style={[styles.fill, { width: `${share * 100}%` }, over && styles.fillOver]} />
                        </View>
                        <Text style={[text.meta, over && styles.over]}>
                          {over ? nb.agreedSum.over : nb.agreedSum.left(groupThousands(Math.round(TAX_FREE_KR - p.minor / 100)))}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.none, shadow.card]}>
                  <Icon name="clip" size={22} color={colors.limeDeep} />
                  <Text style={[text.meta, styles.center]}>{nb.agreedSum.empty}</Text>
                </View>
              )}
            </FadeUp>

            <FadeUp delay={140} style={[styles.mt16, styles.notes]}>
              <Note icon="info">{nb.agreedSum.note}</Note>
              <Note icon="shield">{nb.agreedSum.tax}</Note>
              <PaymentNote />
            </FadeUp>
          </>
        ) : null}
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding, paddingTop: 12 },
  flex: { flex: 1, minWidth: 0 },
  f17: { fontSize: 17 },
  mt16: { marginTop: 16 },
  mb8: { marginBottom: 8 },
  center: { textAlign: 'center' },
  hero: { backgroundColor: colors.ink, borderRadius: radius.listingCard, padding: 22, overflow: 'hidden', gap: 4 },
  glow: { position: 'absolute', right: -60, top: -70, width: 190, height: 190, borderRadius: 95, backgroundColor: colors.lime, opacity: 0.3 },
  heroLabel: { color: colors.onInk62 },
  heroValue: { fontFamily: text.h1.fontFamily, fontSize: 38, lineHeight: 42, letterSpacing: -1, color: colors.white },
  heroSub: { fontFamily: text.body.fontFamily, fontSize: 14, color: colors.onInk78 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: 16 },
  row: { paddingVertical: 14, gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line2 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.lime },
  fillOver: { backgroundColor: colors.warn },
  over: { color: colors.warn },
  none: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, alignItems: 'center', gap: 8 },
  notes: { gap: 10 },
  bottom: { height: 50 },
});
