import { leaveFlow } from '@/lib/nav';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { useYearRecap } from '@/api/queries';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { captureViewAsFile, shareImageFile } from '@/lib/share';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { BrandMark } from '@/components/BrandMark';
import { Button, CategoryArt, Confetti, ErrorState, FadeUp, Icon, RowSkeleton, Screen, SubHeader, type IconKey } from '@/components/ui';

/** «Året ditt på MinNabo»: my own numbers. Only I see them, until I choose to share the card. */
export function YearRecapScreen({ year }: { year: number }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { data, isLoading, isError, refetch } = useYearRecap(year);
  const card = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const first = me.displayName.split(' ')[0] ?? '';
  const stats: { icon: IconKey; value: string; label: string }[] = data
    ? [
        { icon: 'hand', value: String(data.helped), label: nb.recap.helped(data.helped) },
        { icon: 'heart', value: String(data.gotHelp), label: nb.recap.gotHelp(data.gotHelp) },
        { icon: 'users', value: String(data.neighbours), label: nb.recap.neighbours(data.neighbours) },
        ...(data.thanks ? [{ icon: 'star' as const, value: String(data.thanks), label: nb.recap.thanks(data.thanks) }] : []),
      ]
    : [];
  const empty = !!data && data.helped + data.gotHelp === 0;

  const share = async () => {
    if (!card.current) return;
    setSharing(true);
    try {
      const file = await captureViewAsFile(card.current);
      await shareImageFile(file, { title: nb.recap.shareTitle(year), message: nb.recap.shareText(year, data?.helped ?? 0) });
    } catch {
      toast.error(nb.recap.shareFailed);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.recap.title(year)} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}>
      <View style={styles.px}>
        {isLoading ? (
          <View style={styles.mt16}>
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : empty ? (
          <FadeUp style={[styles.emptyCard, shadow.card]}>
            <View style={styles.emptyIcon}>
              <Icon name="sparkle" size={24} color={colors.limeDeep} />
            </View>
            <Text style={[text.h3, styles.center]}>{nb.recap.emptyTitle}</Text>
            <Text style={[text.meta, styles.center]}>{nb.recap.emptyBody}</Text>
            <Button label={nb.recap.findJob} size="sm" block={false} align="center" onPress={() => leaveFlow('/')} />
          </FadeUp>
        ) : data ? (
          <>
            <FadeUp>
              <View ref={card} collapsable={false} style={styles.card}>
                <View style={styles.glow} />
                <View style={styles.brand}>
                  <BrandMark size={26} showWordmark={false} />
                  <Text style={styles.brandText}>MinNabo</Text>
                </View>
                <Text style={styles.year}>{year}</Text>
                <Text style={styles.heading}>{nb.recap.heading(first)}</Text>
                <View style={styles.grid}>
                  {stats.map((s) => (
                    <View key={s.label} style={styles.stat}>
                      <Icon name={s.icon} size={18} color={colors.lime} />
                      <Text style={styles.value}>{s.value}</Text>
                      <Text style={styles.label}>{s.label}</Text>
                    </View>
                  ))}
                </View>
                {data.topCategory ? (
                  <View style={styles.top}>
                    <CategoryArt category={categoryArtId(data.topCategory)} width={40} height={40} radius={13} iconSize={20} />
                    <Text style={styles.topText}>{nb.recap.topCategory(categoryLabel(categoryArtId(data.topCategory)))}</Text>
                  </View>
                ) : null}
                <Text style={styles.foot}>{nb.recap.foot}</Text>
              </View>
            </FadeUp>
            {Platform.OS !== 'web' ? <Button label={nb.recap.share} icon="share" variant="ink" loading={sharing} onPress={() => void share()} style={styles.mt16} /> : null}
            <Text style={[text.meta, styles.center, styles.mt12]}>{nb.recap.privacy}</Text>
          </>
        ) : null}
      </View>
      {data && !empty ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Confetti count={24} />
        </View>
      ) : null}
      <View style={styles.bottom} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding, paddingTop: 12 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  center: { textAlign: 'center' },
  card: { backgroundColor: colors.ink, borderRadius: radius.listingCard, padding: 22, overflow: 'hidden', gap: 6 },
  glow: { position: 'absolute', right: -70, top: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.lime, opacity: 0.32 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  brandText: { fontFamily: text.h3.fontFamily, fontSize: 17, letterSpacing: -0.4, color: colors.white },
  year: { fontFamily: text.h1.fontFamily, fontSize: 52, lineHeight: 54, letterSpacing: -1.8, color: colors.lime },
  heading: { fontFamily: text.h1.fontFamily, fontSize: 24, lineHeight: 28, letterSpacing: -0.6, color: colors.white, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '46%', backgroundColor: colors.onInk14, borderRadius: radius.m, padding: 14, gap: 4 },
  value: { fontFamily: text.h1.fontFamily, fontSize: 30, lineHeight: 33, letterSpacing: -0.8, color: colors.white },
  label: { fontFamily: text.body.fontFamily, fontSize: 13, lineHeight: 17, color: colors.onInk78 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  topText: { flex: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 14.5, lineHeight: 19, color: colors.white },
  foot: { fontFamily: text.body.fontFamily, fontSize: 12.5, color: colors.onInk62, marginTop: 16 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.listingCard, padding: 24, alignItems: 'center', gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  bottom: { height: 50 },
});
