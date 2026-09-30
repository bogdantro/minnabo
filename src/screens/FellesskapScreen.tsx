import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import type { Partner } from '@/domain/types';
import { useDonations, usePartners } from '@/api/queries';
import { isEnabled } from '@/config/featureFlags';
import { formatPrice } from '@/domain/price';
import { nok } from '@/domain/price';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { safePush } from '@/lib/nav';
import { HomeTopBar } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusPill } from '@/components/ui/StatusPill';

export function FellesskapScreen() {
  const me = useCurrentUser();
  const { municipalities, municipality, ready } = useLocationScope();
  const { data: partners = [], isSuccess: partnersLoaded } = usePartners();
  const { data: donations = [], isSuccess: donationsLoaded } = useDonations();
  const mainPartners = partners.filter((p) => p.featured).slice(0, 2);
  // Don't surface local partners until the profile kommune has loaded — an
  // unscoped list here would briefly show supporters from other kommuner.
  const localPartners = !ready
    ? []
    : partners.filter(
        (p) =>
          !p.featured &&
          (municipalities.length === 0 ||
            (p.municipality !== null && municipalities.includes(p.municipality))),
      );

  return (
    <View style={styles.wrap}>
      <HomeTopBar
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.community.title}</ScreenTitle>

        <Card pad style={styles.hero}>
          <Icon name="heart" size={24} color="lime" />
          <AppText variant="cardTitle" weight="bold">
            {nb.community.heading}
          </AppText>
          <AppText variant="body" color="navyMuted">
            {nb.community.intro}
          </AppText>
        </Card>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.neighbourhood.title}
          onPress={() => safePush('/nabolag')}
          style={styles.noticeLink}
        >
          <Icon name="home" size={18} color="lime" />
          <View style={styles.noticeLinkBody}>
            <AppText variant="cardTitle" weight="bold">
              {nb.neighbourhood.title}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              {nb.neighbourhood.joinBody}
            </AppText>
          </View>
          <Icon name="chevron-right" size={18} color="navyMuted" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.noticeboard.title}
          onPress={() => safePush('/oppslagstavle')}
          style={styles.noticeLink}
        >
          <Icon name="clipboard" size={18} color="cyan" />
          <View style={styles.noticeLinkBody}>
            <AppText variant="cardTitle" weight="bold">
              {nb.noticeboard.title}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              {nb.noticeboard.body}
            </AppText>
          </View>
          <Icon name="chevron-right" size={18} color="navyMuted" />
        </Pressable>

        <AppText variant="meta" color="navyMuted">
          {nb.community.partnerNote}
        </AppText>

        <View style={styles.section}>
          <SectionHeader title={nb.community.mainPartners} />
          {partnersLoaded && mainPartners.length === 0 ? (
            <AppText variant="body" color="navyMuted">
              {nb.community.noPartners}
            </AppText>
          ) : (
            <View style={styles.mainGrid}>
              {mainPartners.map((p) => (
                <PartnerCard key={p.id} partner={p} featured />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title={nb.community.localSupporters} />
          {partnersLoaded && localPartners.length === 0 && municipality ? (
            <AppText variant="body" color="navyMuted">
              {nb.location.emptyPartners(municipality)}
            </AppText>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {localPartners.map((p) => (
                <PartnerCard key={p.id} partner={p} />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title={nb.community.donationsTitle} />
          <AppText variant="meta" color="navyMuted">
            {nb.community.donationsNote}
          </AppText>
          {donationsLoaded && donations.length === 0 ? (
            <AppText variant="body" color="navyMuted">
              {nb.community.noDonations}
            </AppText>
          ) : null}
          {donations.map((d) => (
            <Card pad key={d.id} style={styles.donation}>
              <View style={styles.donationRow}>
                <AppText variant="body" weight="bold">
                  {formatPrice(nok(d.amountKr))}
                </AppText>
                <StatusPill label={nb.community.transferred} tone="lime" />
              </View>
              <AppText variant="meta" color="navyMuted">
                {d.recipient} · {d.period}
              </AppText>
            </Card>
          ))}
        </View>

        {!isEnabled('redCross') ? (
          <Card pad style={styles.pending}>
            <Icon name="info" size={16} color="navyMuted" />
            <AppText variant="meta" color="navyMuted">
              {nb.community.redCrossPending}
            </AppText>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function PartnerCard({ partner, featured = false }: { partner: Partner; featured?: boolean }) {
  return (
    <Card pad style={[styles.partner, featured ? styles.partnerFeatured : styles.partnerLocal]}>
      <View style={styles.partnerLogo}>
        <AppText weight="extrabold" color="navy" style={styles.partnerInitials}>
          {partner.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)}
        </AppText>
      </View>
      <AppText variant="cardTitle" weight="bold" numberOfLines={2}>
        {partner.name}
      </AppText>
      <AppText variant="meta" color="navyMuted" numberOfLines={2}>
        {partner.tagline}
      </AppText>
      {partner.municipality ? (
        <AppText variant="meta" color="navyMuted">
          {partner.municipality}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.lg,
  },
  hero: { gap: tokens.space.sm, backgroundColor: tokens.color.limeTint, borderColor: tokens.color.lime },
  noticeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    ...tokens.shadow.card,
  },
  noticeLinkBody: { flex: 1, gap: 1 },
  section: { gap: tokens.space.sm },
  mainGrid: { flexDirection: 'row', gap: tokens.space.md },
  carousel: { gap: tokens.space.md, paddingVertical: tokens.space.xs },
  partner: { gap: 4, padding: tokens.space.md },
  partnerFeatured: { flex: 1 },
  partnerLocal: { width: 160 },
  partnerLogo: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  partnerInitials: { fontSize: 15 },
  donation: { gap: 4, padding: tokens.space.md },
  donationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pending: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'center', padding: tokens.space.md },
});
