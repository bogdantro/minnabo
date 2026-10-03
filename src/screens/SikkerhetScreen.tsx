import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import Animated, { FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import type { PublicProfile } from '@/domain/types';
import nb from '@/i18n/nb';
import { apiClient } from '@/api/client';
import { profileKeys, useBlockedProfileIds, useListing, useMyAgreements, useProfile, useToggleBlock } from '@/api/queries';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { useTrustedContacts } from '@/lib/trustedContacts';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { TryggTurCard, type TryggTurContext } from '@/components/TryggTurCard';
import {
  Avatar,
  Button,
  Dialog,
  FadeUp,
  Icon,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  SubHeader,
  type IconName,
} from '@/components/ui';

/** Sikkerhet (design/screens/Sikkerhet.dc.html). */
export function SikkerhetScreen() {
  const router = useRouter();
  const { contacts } = useTrustedContacts();
  const { data: blockedIds = [] } = useBlockedProfileIds();
  const toggleBlock = useToggleBlock();
  const [ask, setAsk] = useState<PublicProfile | null>(null);
  const [tip, setTip] = useState<number | null>(0);

  const blocked = useQueries({
    queries: blockedIds.map((id) => ({ queryKey: profileKeys.profile(id), queryFn: () => apiClient.getProfile(id) })),
  })
    .map((q) => q.data)
    .filter((p): p is PublicProfile => !!p);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const unblock = (p: PublicProfile) => {
    setAsk(null);
    toggleBlock.mutate(p.id, {
      onSuccess: () => toast.success(nb.sikkerhet.unblocked(p.displayName)),
      onError: () => toast.error(nb.toast.genericError),
    });
  };

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.sikkerhet.title} onBack={back} />}>
      <FadeUp style={[styles.px, styles.pt6]}>
        <Text style={text.h1} accessibilityRole="header">
          {nb.sikkerhet.heading}
        </Text>
        <Text style={[text.meta, styles.mt8]}>{nb.sikkerhet.sub}</Text>
      </FadeUp>

      <FadeUp delay={80} style={[styles.px, styles.mt18]}>
        <NextJobTrip />
      </FadeUp>

      <FadeUp delay={120} style={[styles.px, styles.mt16]}>
        <ListGroup style={shadow.card}>
          <ListRow
            icon="flag"
            iconBg={colors.dangerTint}
            iconColor={colors.danger}
            title={nb.sikkerhet.report.title}
            subtitle={nb.sikkerhet.report.sub}
            chevron
            onPress={() => safePush('/rapporter')}
          />
          <ListRow
            icon="users"
            iconBg={colors.limeTint}
            iconColor={colors.limeDeep}
            title={nb.sikkerhet.contacts.title}
            subtitle={contacts.length ? contacts.map((c) => c.name).join(` ${nb.tryggTur.and} `) : nb.sikkerhet.contacts.none}
            right={
              contacts.length ? (
                <View style={styles.avs}>
                  {contacts.slice(0, 2).map((c, i) => (
                    <View key={c.id} style={[styles.avRing, i > 0 && styles.avOverlap]}>
                      <Avatar initials={c.name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()} seed={c.id} size={28} ring={false} />
                    </View>
                  ))}
                </View>
              ) : undefined
            }
            chevron
            onPress={() => safePush('/trygge-kontakter')}
          />
          <ListRow
            icon="lock"
            iconBg={colors.cyanTint}
            iconColor={colors.cyanDeep}
            title={nb.sikkerhet.privacy.title}
            subtitle={nb.sikkerhet.privacy.sub}
            chevron
            onPress={() => safePush('/personvern')}
          />
        </ListGroup>
      </FadeUp>

      <SectionHeader title={nb.sikkerhet.blockedTitle} subtitle={nb.sikkerhet.blockedSub} icon="ban" iconBg={colors.neutralPill} iconColor={colors.ink2} />
      <FadeUp style={styles.px}>
        <View style={[styles.list, shadow.card]}>
          {blocked.map((p, i) => (
            <Animated.View key={p.id} exiting={FadeOutLeft.duration(400)} layout={LinearTransition.duration(300)} style={[styles.brow, i > 0 && styles.browDivider]}>
              <Avatar initials={p.initials} uri={p.avatarUrl} seed={p.id} size={40} ring={false} />
              <View style={styles.flex}>
                <Text style={styles.bname}>{p.displayName}</Text>
                <Text style={[text.meta, styles.f125]}>{nb.sikkerhet.blocked}</Text>
              </View>
              <Button
                label={nb.sikkerhet.unblock}
                variant="ghost"
                size="sm"
                block={false}
                accessibilityLabel={nb.sikkerhet.unblockAria(p.displayName)}
                onPress={() => setAsk(p)}
              />
            </Animated.View>
          ))}
          {blocked.length === 0 ? (
            <View style={styles.none}>
              <View style={styles.noneIcon}>
                <Icon name="check" size={22} color={colors.ok} />
              </View>
              <Text style={styles.noneTitle}>{nb.sikkerhet.noneTitle}</Text>
              <Text style={[text.meta, styles.centerText]}>{nb.sikkerhet.noneBody}</Text>
            </View>
          ) : null}
        </View>
      </FadeUp>

      <SectionHeader title={nb.sikkerhet.tipsTitle} icon="shield" iconBg={colors.warnTint} iconColor={colors.warn} />
      <FadeUp style={styles.px}>
        <View style={[styles.list, shadow.card]}>
          {nb.sikkerhet.tips.map((t, i) => {
            const open = tip === i;
            return (
              <View key={t.q} style={[styles.acc, i < nb.sikkerhet.tips.length - 1 && styles.accDivider]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setTip(open ? null : i)}
                  style={styles.accHead}
                >
                  <View style={styles.accIcon}>
                    <Icon name={t.icon as IconName} size={16} color={colors.ink} />
                  </View>
                  <Text style={styles.accQ}>{t.q}</Text>
                  <Icon name={open ? 'up' : 'down'} size={18} color={colors.faint} />
                </Pressable>
                {open ? (
                  <FadeUp>
                    <Text style={styles.accA}>{t.a}</Text>
                  </FadeUp>
                ) : null}
              </View>
            );
          })}
        </View>
      </FadeUp>

      <FadeUp style={[styles.px, styles.mt16]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${nb.sikkerhet.emergencyStrong}${nb.sikkerhet.emergency} ${nb.sikkerhet.call112}`}
          onPress={() => Linking.openURL('tel:112').catch(() => undefined)}
          style={styles.sos}
        >
          <View style={styles.sosIcon}>
            <Icon name="alert" size={18} color={colors.white} />
          </View>
          <Text style={styles.sosText}>
            <Text style={styles.sosStrong}>{nb.sikkerhet.emergencyStrong}</Text>
            {nb.sikkerhet.emergency}
          </Text>
        </Pressable>
      </FadeUp>
      <View style={styles.bottom} />

      <Dialog
        visible={!!ask}
        onClose={() => setAsk(null)}
        title={ask ? nb.sikkerhet.unblockTitle(ask.displayName) : ''}
        body={ask ? nb.sikkerhet.unblockBody(ask.displayName) : ''}
        icon="ban"
        tone="neutral"
        actions={
          <View style={styles.stack8}>
            <Button label={nb.sikkerhet.unblockConfirm} variant="ink" onPress={() => {
              if (ask) unblock(ask);
            }} />
            <Button label={nb.sikkerhet.cancel} variant="ghost" onPress={() => setAsk(null)} />
          </View>
        }
      />
    </Screen>
  );
}

/** Trygg tur tied to my next job as helper, when there is one. */
function NextJobTrip() {
  const { data: agreements } = useMyAgreements();
  const next = (agreements ?? []).find((a) => a.role === 'HELPER' && !a.fullyCompleted && !a.cancelled);
  const { data: listing } = useListing(next?.listingId ?? '');
  const { data: who } = useProfile(next?.counterpartId ?? '');
  const context: TryggTurContext | undefined = next
    ? {
        proposalId: next.proposalId,
        title: next.listingTitle,
        who: who?.displayName,
        place: listing ? [listing.location.place, listing.location.municipality].filter((s, i, a) => s && a.indexOf(s) === i).join(', ') : undefined,
      }
    : undefined;
  return <TryggTurCard context={context} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  pt6: { paddingTop: 6 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  f125: { fontSize: 12.5 },
  stack8: { gap: 8 },
  bottom: { height: 60 },
  avs: { flexDirection: 'row' },
  avRing: { borderRadius: 16, borderWidth: 2, borderColor: colors.white },
  avOverlap: { marginLeft: -7 },
  list: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  brow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingRight: 14, paddingLeft: 16 },
  browDivider: { borderTopWidth: 1, borderTopColor: colors.line2 },
  bname: { fontFamily: fonts.bodySemi, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  none: { padding: 22, alignItems: 'center', gap: 8 },
  noneIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.okTint, alignItems: 'center', justifyContent: 'center' },
  noneTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  centerText: { textAlign: 'center' },
  acc: {},
  accDivider: { borderBottomWidth: 1, borderBottomColor: colors.line2 },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 10, paddingHorizontal: 16 },
  accIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  accQ: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 19.5, color: colors.ink },
  accA: { paddingRight: 16, paddingBottom: 16, paddingLeft: 62, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink2 },
  sos: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.dangerTint },
  sosIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  sosText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18.9, color: colors.sosText },
  sosStrong: { fontFamily: fonts.bodyBold },
});
