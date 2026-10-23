import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Partner } from '@/domain/types';
import nb from '@/i18n/nb';
import { usePartners } from '@/api/queries';
import { useLocationScope } from '@/lib/locationScope';
import { logPartnerClick } from '@/lib/partnerStats';
import { ThanksButton, ThanksCount } from '@/components/PartnerThanks';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import {
  Button,
  ErrorState,
  FadeUp,
  Icon,
  Note,
  Pill,
  RowSkeleton,
  ScaleIn,
  Screen,
  SubHeader,
  type IconName,
} from '@/components/ui';

const t = nb.partner;

/**
 * A hovedpartner's own page (`/partner/<id>`): cover, logo, who they are, what
 * they offer the neighbours, photos and how to reach them. Only hovedpartnere
 * get this page – lokale helter open a short sheet on Fellesskap.
 */
export function PartnerScreen({ partnerId }: { partnerId: string }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = usePartners();
  // Only hovedpartnere have a page (with the link to their website). A lokal helt has the sheet on
  // Fellesskap; a lokal støttespiller has no link at all – also not through a direct link here.
  const partner = (data ?? []).find((p) => p.id === partnerId && p.featured);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/fellesskap'));

  if (!partner) {
    return (
      <Screen header={<SubHeader title={t.title} onBack={back} />}>
        {isLoading ? (
          <View style={styles.skel}>
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : (
          <ErrorState title={isError ? undefined : t.notFound} onRetry={() => void refetch()} />
        )}
      </Screen>
    );
  }

  return (
    <Screen scroll spacer="none" header={<SubHeader title={t.title} onBack={back} />}>
      <Body partner={partner} />
    </Screen>
  );
}

function Body({ partner: p }: { partner: Partner }) {
  const { municipality } = useLocationScope();
  // "Besøk nettsiden" counts as a click in the partner's statistics, then opens the link
  const visit = () => {
    logPartnerClick(p.id, municipality);
    void Linking.openURL(p.url!);
  };
  const web = p.url?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const contact: { icon: IconName; label: string; value: string; onPress?: () => void }[] = [
    ...(p.url ? [{ icon: 'globe' as IconName, label: t.website, value: web!, onPress: visit }] : []),
    ...(p.phone ? [{ icon: 'phone' as IconName, label: t.phone, value: p.phone, onPress: () => void Linking.openURL(`tel:${p.phone!.replace(/\s/g, '')}`) }] : []),
    ...(p.email ? [{ icon: 'mail' as IconName, label: t.email, value: p.email, onPress: () => void Linking.openURL(`mailto:${p.email}`) }] : []),
    ...(p.address ? [{ icon: 'pin' as IconName, label: t.address, value: p.address }] : []),
    ...(p.openingHours ? [{ icon: 'clock' as IconName, label: t.hours, value: p.openingHours }] : []),
    { icon: 'map' as IconName, label: t.area, value: p.municipality ?? 'Innlandet' },
  ];

  return (
    <View>
      {/* cover + logo */}
      <View style={styles.cover}>
        {p.coverUrl ? (
          <Image source={{ uri: p.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <>
            <View style={styles.glow1} />
            <View style={styles.glow2} />
          </>
        )}
      </View>
      <View style={styles.px}>
        <ScaleIn style={[styles.logo, shadow.medium]}>
          {p.logoUrl ? (
            <Image source={{ uri: p.logoUrl }} style={styles.logoImg} resizeMode="contain" accessibilityIgnoresInvertColors />
          ) : (
            <Icon name="building" size={36} color={colors.faint} />
          )}
        </ScaleIn>
        <FadeUp style={styles.head}>
          <Pill label={nb.fellesskap.mainBadge} tone="accent" icon="award" style={styles.selfStart} />
          <Text style={text.h1} accessibilityRole="header">
            {p.name}
          </Text>
          <Text style={[text.body, styles.ink2]}>{p.tagline}</Text>
        </FadeUp>

        {p.url ? (
          <FadeUp delay={60} style={styles.mt18}>
            <Button label={t.visit} icon="arrowur" variant="ink" onPress={visit} />
          </FadeUp>
        ) : null}

        {p.about ? (
          <FadeUp delay={100} style={[styles.card, shadow.card]}>
            <Text style={text.eyebrow}>{t.about}</Text>
            <Text style={[text.body, styles.para]}>{p.about}</Text>
          </FadeUp>
        ) : null}

        {p.offer ? (
          <FadeUp delay={140} style={[styles.card, styles.offer]}>
            <View style={styles.offerIcon}>
              <Icon name="sparkle" size={18} color={colors.limeDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={text.eyebrow}>{t.offer}</Text>
              <Text style={[text.body, styles.para]}>{p.offer}</Text>
            </View>
          </FadeUp>
        ) : null}

        {p.prices?.length ? (
          <FadeUp delay={160} style={[styles.card, shadow.card]}>
            <Text style={text.eyebrow}>{t.prices}</Text>
            <View style={styles.prices}>
              {p.prices.map((row, i) => (
                <View key={`${row.name}-${i}`} style={[styles.priceRow, i > 0 && styles.priceLine]}>
                  <Text style={[text.body, styles.flex]}>{row.name}</Text>
                  <Text style={styles.priceValue}>{row.price}</Text>
                </View>
              ))}
            </View>
            {/* rule 4: a payment note next to every price */}
            <Note style={styles.mt10}>{t.pricesNote(p.name)}</Note>
          </FadeUp>
        ) : null}

        {p.gallery?.length ? (
          <FadeUp delay={180} style={styles.gallery}>
            {p.gallery.map((uri) => (
              <View key={uri} style={[styles.photo, shadow.card]}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
              </View>
            ))}
          </FadeUp>
        ) : null}

        <FadeUp delay={220} style={[styles.card, styles.contact, shadow.card]}>
          <Text style={[text.eyebrow, styles.contactHead]}>{t.contact}</Text>
          {contact.map((c, i) => {
            const row = (
              <>
                {i > 0 ? <View style={styles.line} /> : null}
                <View style={styles.rowIcon}>
                  <Icon name={c.icon} size={18} color={colors.ink2} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowLabel}>{c.label}</Text>
                  <Text style={[styles.rowValue, c.onPress && { color: colors.cyanDeep }]}>{c.value}</Text>
                </View>
                {c.onPress ? <Icon name="right" size={18} color={colors.faint} /> : null}
              </>
            );
            return c.onPress ? (
              <Pressable key={c.label} accessibilityRole="link" accessibilityLabel={`${c.label}: ${c.value}`} onPress={c.onPress} style={styles.row}>
                {row}
              </Pressable>
            ) : (
              <View key={c.label} style={styles.row}>
                {row}
              </View>
            );
          })}
        </FadeUp>

        <ThanksCount partnerId={p.id} style={styles.thanks} />
        <ThanksButton partner={p} style={styles.mt10} />
        <View style={styles.bottom} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  flex: { flex: 1, minWidth: 0 },
  selfStart: { alignSelf: 'flex-start' },
  ink2: { color: colors.ink2 },
  mt18: { marginTop: 18 },
  mt10: { marginTop: 10 },
  thanks: { marginTop: 18, alignSelf: 'center' },
  skel: { paddingHorizontal: screenPadding, paddingTop: 16, gap: 18 },
  cover: { height: 168, backgroundColor: colors.ink, overflow: 'hidden' },
  glow1: { position: 'absolute', right: -60, top: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.lime, opacity: 0.35 },
  glow2: { position: 'absolute', left: -50, bottom: -100, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.cyan, opacity: 0.2 },
  logo: {
    width: 104,
    height: 104,
    borderRadius: 30,
    marginTop: -52,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '78%', height: '78%' },
  head: { marginTop: 16, gap: 8 },
  card: { marginTop: 14, padding: 18, borderRadius: radius.card, backgroundColor: colors.white },
  para: { marginTop: 10, color: colors.ink2 },
  offer: { flexDirection: 'row', gap: 12, backgroundColor: colors.limeTint },
  offerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  gallery: { marginTop: 14, gap: 12 },
  prices: { marginTop: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 10 },
  priceLine: { borderTopWidth: 1, borderTopColor: colors.line2 },
  priceValue: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: colors.ink },
  photo: { height: 200, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.track },
  contact: { paddingHorizontal: 0, paddingBottom: 6 },
  contactHead: { paddingHorizontal: 18, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 18, paddingVertical: 10 },
  line: { position: 'absolute', top: 0, left: 70, right: 0, height: 1, backgroundColor: colors.line2 },
  rowIcon: { width: 40, height: 40, borderRadius: radius.rowIcon, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.mute },
  rowValue: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: colors.ink },
  bottom: { height: 48 },
});
