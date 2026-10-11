import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import nb from '@/i18n/nb';
import { signOut } from '@/auth/session';
import { toast } from '@/lib/toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  useListing,
  useMyAgreements,
  useMyListings,
  useProfile,
  useReceivedProposals,
  useSavedListingIds,
  useSavedSearches,
  useUpdateProfile,
  useUnreadConversationCount,
  useUnreadNotificationCount,
} from '@/api/queries';
import { isEnabled } from '@/config/featureFlags';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import {
  Avatar,
  CountBadge,
  Dialog,
  FadeUp,
  Icon,
  ListGroup,
  ListRow,
  PressableScale,
  Sheet,
  Toggle,
  type IconKey,
} from './ui';

const VERIFY_WORD = { PHONE: 'telefon', EMAIL: 'e-post', BUSINESS: 'bedrift' } as const;
const ACTIVE = new Set(['PUBLISHED', 'RECEIVING_OFFERS']);

function Section({ children, delay }: { children: string; delay: number }) {
  return (
    <FadeUp delay={delay}>
      <Text style={styles.msec}>{children}</Text>
    </FadeUp>
  );
}

function Tile({
  icon,
  iconBg,
  iconFg,
  title,
  sub,
  badge = 0,
  dark = false,
  onPress,
  a11y,
}: {
  icon: IconKey;
  iconBg: string;
  iconFg: string;
  title: string;
  sub: string;
  badge?: number;
  dark?: boolean;
  onPress: () => void;
  a11y?: string;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y ?? title}
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.tile, shadow.card, dark && styles.tileDark]}
    >
      {dark ? <View style={styles.tileGlow} /> : null}
      <View style={[styles.tileIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={20} color={iconFg} />
        {badge ? <CountBadge count={badge} style={styles.tileCount} /> : null}
      </View>
      <View>
        <Text style={[styles.tileTitle, dark && { color: colors.white }]}>{title}</Text>
        <Text style={[text.statLabel, styles.tileSub, dark && { color: colors.onInk72 }]}>{sub}</Text>
      </View>
      <View style={styles.go}>
        <Icon name="arrowur" size={16} color={dark ? colors.onInk72 : colors.faint} />
      </View>
    </PressableScale>
  );
}

/** Red count pill on list rows (`.rbadge`). */
function RowBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <View style={styles.rbadge}>
      <Text style={[text.count, styles.rbadgeText]}>{n > 99 ? '99+' : n}</Text>
    </View>
  );
}

function Rows({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <FadeUp delay={delay}>
      <ListGroup>{children}</ListGroup>
    </FadeUp>
  );
}

/** Meny – opened from the tab bar (design/screens/Meny.dc.html). */
export function MenySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const me = useCurrentUser();
  const profile = useProfile(me.id).data;
  const inboxUnread = useUnreadConversationCount();
  const notifUnread = useUnreadNotificationCount();
  const agreements = useMyAgreements().data ?? [];
  const myTasks = useMyListings('TASK_REQUEST').data ?? [];
  const received = useReceivedProposals().data ?? [];
  const savedIds = useSavedListingIds().data ?? [];
  const savedSearches = useSavedSearches().data ?? [];
  const updateProfile = useUpdateProfile();
  // optimistic: the switch moves at once and falls back if saving fails
  const [availLocal, setAvailLocal] = useState<boolean | null>(null);
  const avail = availLocal ?? profile?.availableForJobs ?? true;
  const toggleAvail = (on: boolean) => {
    setAvailLocal(on);
    updateProfile.mutate(
      { availableForJobs: on },
      {
        onSuccess: () => toast.success(on ? nb.meny.avail.onToast : nb.meny.avail.offToast),
        onError: () => {
          setAvailLocal(null);
          toast.error(nb.meny.avail.error);
        },
      },
    );
  };
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const pending = received.filter((p) => p.status === 'SENT');
  const latestListing = useListing(pending[0]?.listingId ?? '').data;
  const next = agreements.find((a) => !a.fullyCompleted && a.scheduledText);
  const active = myTasks.filter((l) => ACTIVE.has(l.status)).length;
  const paused = myTasks.filter((l) => l.status === 'PAUSED').length;
  const verified = (profile?.verifications ?? [])
    .filter((v) => v.verified)
    .map((v) => VERIFY_WORD[v.kind]);
  const rating = profile?.rating?.count ? profile.rating.average : null;
  const jobs = profile?.completedTasks ?? 0;
  const place = profile?.location.place || profile?.location.municipality;
  const version = Constants.expoConfig?.version ?? '';

  const go = (route: string) => {
    onClose();
    router.push(route as never);
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      setLogoutOpen(false);
      onClose();
      router.replace('/velkommen');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        title={nb.meny.title}
        titleSize="h2"
        heightRatio={0.89}
        tone="page"
        padding={16}
        scroll
      >
        <FadeUp delay={50} style={[styles.uhead, shadow.card]}>
          <View style={styles.bgc} />
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`${me.displayName}. ${nb.meny.seeProfile}`}
            onPress={() => go('/profil')}
            scaleTo={0.985}
            style={styles.ulink}
          >
            <Avatar initials={me.initials} uri={me.avatarUrl} me size={56} />
            <View style={styles.uinfo}>
              <View style={styles.row6}>
                <Text style={[text.h3, styles.uname]} numberOfLines={1}>
                  {me.displayName}
                </Text>
                {verified.length ? <Icon name="verified" size={18} color={colors.ok} /> : null}
              </View>
              <View style={styles.row10}>
                {rating != null ? (
                  <View style={styles.ustat}>
                    <Icon name="star" size={14} color={colors.star} />
                    <Text style={text.stars}>{rating.toFixed(1).replace('.', ',')}</Text>
                  </View>
                ) : null}
                {rating != null ? <View style={styles.sep} /> : null}
                <Text style={[text.metaBold, { color: colors.ink2, fontFamily: text.bodySemi.fontFamily }]}>
                  {nb.meny.jobs(jobs)}
                </Text>
                {place ? <View style={styles.sep} /> : null}
                {place ? (
                  <Text style={text.meta} numberOfLines={1}>
                    {place}
                  </Text>
                ) : null}
              </View>
              <View style={styles.seeProfile}>
                <Text style={[text.link, { fontSize: 13.5 }]}>{nb.meny.seeProfile}</Text>
                <Icon name="right" size={14} color={colors.cyanDeep} />
              </View>
            </View>
          </PressableScale>
          <View style={styles.avail}>
            <View style={styles.availIcon}>
              <Icon name="hand" size={16} color={colors.cyanDeep} />
            </View>
            <View style={styles.availText}>
              <Text style={styles.availTitle}>{nb.meny.avail.title}</Text>
              <Text style={text.meta}>{avail ? nb.meny.avail.on : nb.meny.avail.off}</Text>
            </View>
            <Toggle value={avail} onValueChange={toggleAvail} accessibilityLabel={nb.meny.avail.title} />
          </View>
        </FadeUp>

        <Section delay={100}>{nb.meny.explore}</Section>
        <View style={styles.grid}>
          <FadeUp delay={100} style={styles.cell}>
            <Tile
              icon="clip"
              iconBg={colors.limeTint}
              iconFg={colors.limeDeep}
              title={nb.meny.tiles.oppdrag.title}
              sub={nb.meny.tiles.oppdrag.sub}
              onPress={() => go('/')}
            />
          </FadeUp>
          <FadeUp delay={150} style={styles.cell}>
            <Tile
              icon="users"
              iconBg={colors.cyanTint}
              iconFg={colors.cyanDeep}
              title={nb.meny.tiles.fellesskap.title}
              sub={nb.meny.tiles.fellesskap.sub}
              onPress={() => go('/fellesskap')}
            />
          </FadeUp>
          <FadeUp delay={200} style={styles.cell}>
            <Tile
              icon="msg"
              iconBg={colors.lavenderTint}
              iconFg={colors.lavender}
              title={nb.meny.tiles.innboks.title}
              sub={nb.meny.tiles.innboks.sub(inboxUnread)}
              badge={inboxUnread}
              a11y={inboxUnread ? nb.meny.unread(nb.meny.tiles.innboks.title, inboxUnread) : undefined}
              onPress={() => go('/innboks')}
            />
          </FadeUp>
          <FadeUp delay={250} style={styles.cell}>
            <Tile
              icon="plus"
              iconBg={colors.lime}
              iconFg={colors.ink}
              title={nb.meny.tiles.leggUt.title}
              sub={nb.meny.tiles.leggUt.sub}
              dark
              onPress={() => go('/legg-ut')}
            />
          </FadeUp>
        </View>

        <Section delay={250}>{nb.meny.mine}</Section>
        <Rows delay={250}>
          <ListRow
            icon="user"
            iconBg={colors.ink}
            iconColor={colors.white}
            title={nb.meny.profile.title}
            subtitle={nb.meny.profile.sub}
            onPress={() => go('/profil')}
          />
          <ListRow
            icon="cal"
            iconBg={colors.okTint}
            iconColor={colors.ok}
            title={nb.meny.agreements.title}
            subtitle={nb.meny.agreements.sub(next?.scheduledText)}
            onPress={() => go('/avtaler')}
          />
          <ListRow
            icon="list"
            iconBg={colors.limeTint}
            iconColor={colors.limeDeep}
            title={nb.meny.myListings.title}
            subtitle={nb.meny.myListings.sub(active, paused)}
            onPress={() => go('/mine')}
          />
          <ListRow
            icon="tag"
            iconBg={colors.cyanTint}
            iconColor={colors.cyanDeep}
            title={nb.meny.offers.title}
            subtitle={nb.meny.offers.sub(latestListing?.title)}
            right={<RowBadge n={pending.length} />}
            accessibilityLabel={pending.length ? nb.meny.newOffers(nb.meny.offers.title, pending.length) : undefined}
            onPress={() => go('/tilbud')}
          />
          <ListRow
            icon="heart"
            iconBg={colors.savedBg}
            iconColor={colors.heart}
            title={nb.meny.saved.title}
            subtitle={nb.meny.saved.sub(savedIds.length, savedSearches.length)}
            onPress={() => go('/lagrede')}
          />
          <ListRow
            icon="bell"
            iconBg={colors.warnTint}
            iconColor={colors.warn}
            title={nb.meny.notifications.title}
            subtitle={nb.meny.notifications.sub}
            right={<RowBadge n={notifUnread} />}
            accessibilityLabel={notifUnread ? nb.meny.unread(nb.meny.notifications.title, notifUnread) : undefined}
            onPress={() => go('/varsler')}
          />
        </Rows>

        <Section delay={400}>{nb.meny.trust}</Section>
        <Rows delay={400}>
          <ListRow
            icon="shield"
            iconBg={colors.okTint}
            iconColor={colors.ok}
            title={nb.meny.verify.title}
            subtitle={nb.meny.verifiedSub(verified)}
            onPress={() => go('/verifisering')}
          />
          <ListRow
            icon="flag"
            iconBg={colors.dangerTint}
            iconColor={colors.danger}
            title={nb.meny.safety.title}
            subtitle={nb.meny.safety.sub}
            onPress={() => go('/sikkerhet')}
          />
        </Rows>

        <Section delay={500}>{nb.meny.settings}</Section>
        <Rows delay={500}>
          <ListRow icon="gear" title={nb.meny.settingsRow} onPress={() => go('/innstillinger')} />
          <ListRow
            icon="lock"
            iconBg={colors.lavenderTint}
            iconColor={colors.lavender}
            title={nb.meny.privacy.title}
            subtitle={nb.meny.privacy.sub}
            onPress={() => go('/personvern')}
          />
          <ListRow icon="file" title={nb.meny.terms} onPress={() => go('/vilkar')} />
          <ListRow
            icon="sliders"
            iconBg={colors.warnTint}
            iconColor={colors.warn}
            title={nb.meny.notifPrefs.title}
            subtitle={nb.meny.notifPrefs.sub}
            onPress={() => go('/varslinger')}
          />
          {isEnabled('businessRegistration') ? (
            <ListRow
              icon="building"
              iconBg={colors.cyanTint}
              iconColor={colors.cyanDeep}
              title={nb.meny.business.title}
              subtitle={nb.meny.business.sub}
              onPress={() => go('/bedrift')}
            />
          ) : null}
        </Rows>

        <FadeUp delay={600} style={styles.mt14}>
          <ListGroup>
            <ListRow
              icon="logout"
              iconBg={colors.dangerTint}
              iconColor={colors.danger}
              title={nb.meny.logout}
              danger
              chevron={false}
              onPress={() => setLogoutOpen(true)}
            />
          </ListGroup>
        </FadeUp>

        <Text style={[text.meta, styles.version]}>{nb.meny.version(version)}</Text>
      </Sheet>

      <Dialog
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        icon="logout"
        title={nb.meny.logoutTitle}
        body={nb.meny.logoutBody}
        cancelLabel="Avbryt"
        confirmLabel={nb.meny.logout}
        onConfirm={logout}
        loading={loggingOut}
      />
    </>
  );
}

const styles = StyleSheet.create({
  mt14: { marginTop: 14 },
  uhead: {
    borderRadius: 26,
    backgroundColor: colors.white,
    padding: 16,
    overflow: 'hidden',
  },
  bgc: {
    position: 'absolute',
    right: -70,
    top: -90,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.limeSoft,
  },
  ulink: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  uinfo: { flex: 1, minWidth: 0, gap: 5 },
  uname: { fontSize: 19, flexShrink: 1 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row10: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ustat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sep: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.control },
  seeProfile: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  avail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line2,
  },
  availIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cyanTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availText: { flex: 1, minWidth: 0 },
  availTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 18, color: colors.ink },
  msec: { ...text.eyebrow, marginTop: 24, marginBottom: 10, marginHorizontal: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48.5%', flexGrow: 1 },
  tile: {
    gap: 12,
    padding: 14,
    minHeight: 112,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  tileDark: { backgroundColor: colors.ink },
  tileGlow: {
    position: 'absolute',
    right: -40,
    bottom: -50,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.lime,
    opacity: 0.4,
  },
  tileIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileCount: { position: 'absolute', top: -5, right: -7 },
  tileTitle: { fontFamily: text.h3.fontFamily, fontSize: 16, lineHeight: 18.4, letterSpacing: -0.24, color: colors.ink },
  tileSub: { marginTop: 3 },
  go: { position: 'absolute', right: 12, top: 14 },
  rbadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: colors.notifDot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rbadgeText: { fontSize: 12, lineHeight: 22 },
  version: { textAlign: 'center', marginTop: 18 },
});
