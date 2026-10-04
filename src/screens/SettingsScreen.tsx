import { useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import type { NotificationPrefs } from '@/api/ApiClient';
import nb from '@/i18n/nb';
import { useMyListings, useMySettings, useProfile, useUpdateNotificationPrefs, useUpdateProfile } from '@/api/queries';
import { signOut } from '@/auth/session';
import { FLAG_META, setFlagOverride, useFeatureFlags, type FeatureFlag } from '@/config/featureFlags';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ENV } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { useLocationScope, type Reach } from '@/lib/locationScope';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { LocationSheet } from '@/components/LocationSheet';
import {
  Avatar,
  Button,
  Dialog,
  FadeUp,
  Icon,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  Segmented,
  SubHeader,
  Toggle,
  VerifiedIcon,
} from '@/components/ui';

const DEV_KEY = 'devMode';

/** Innstillinger (design/screens/Innstillinger.dc.html). */
export function SettingsScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: profile } = useProfile(me.id);
  const { data: settings } = useMySettings();
  const savePrefs = useUpdateNotificationPrefs();
  const update = useUpdateProfile();
  const { data: myListings } = useMyListings('TASK_REQUEST');
  const { municipality, reach, setKommune, setReach } = useLocationScope();
  const flags = useFeatureFlags();

  const [locOpen, setLocOpen] = useState(false);
  const [logout, setLogout] = useState(false);
  const [big, setBig] = useState(false);
  const [dev, setDev] = useState(false);

  const version = Constants.expoConfig?.version ?? '';
  const showDev = __DEV__ || me.isAdmin;
  const paused = !!profile?.paused;
  const hidden = (myListings ?? []).filter((l) => !['PAUSED', 'ARCHIVED', 'REMOVED', 'COMPLETED', 'REVIEWED', 'CANCELLED', 'EXPIRED'].includes(l.status)).length;
  const verified = (k: 'PHONE' | 'EMAIL') => !!profile?.verifications.some((v) => v.kind === k && v.verified);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const setChannel = (key: 'push' | 'email', on: boolean) => {
    if (!settings) return;
    const prefs: NotificationPrefs = { ...settings.notificationPrefs, channels: { ...settings.notificationPrefs.channels, [key]: on } };
    const label = key === 'push' ? nb.innstillinger.push : nb.innstillinger.mail;
    savePrefs.mutate(prefs, {
      onSuccess: () => toast.success(on ? nb.innstillinger.on(label) : nb.innstillinger.off(label), { icon: on ? 'bell' : 'x' }),
      onError: () => toast.error(nb.toast.genericError),
    });
  };

  const setFerie = (on: boolean) =>
    update.mutate(
      { paused: on },
      {
        onSuccess: () => {
          haptics.light();
          toast.success(on ? nb.innstillinger.ferieOnToast : nb.innstillinger.ferieOffToast, { icon: on ? 'sun' : 'check' });
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );

  const applyLocation = (k: string, r: Reach) => {
    setLocOpen(false);
    setKommune(k);
    setReach(r);
    toast.success(nb.oppdrag.showing(nb.oppdrag.reach[r].name, k), { icon: 'pin' });
  };

  const doLogout = async () => {
    setLogout(false);
    await signOut();
    router.replace('/velkommen');
  };

  const flagKeys = Object.keys(flags) as FeatureFlag[];

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.innstillinger.title} onBack={back} />}>
      {/* profile */}
      <FadeUp style={[styles.px, styles.mt8]}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${me.displayName}, ${nb.innstillinger.verified}`}
          onPress={() => safePush('/profil')}
          style={[styles.card, styles.profile, shadow.card]}
        >
          <Avatar initials={me.initials} uri={me.avatarUrl} size={56} me />
          <View style={styles.flex}>
            <Text style={styles.pname}>{me.displayName}</Text>
            <View style={styles.vbadge}>
              <VerifiedIcon size={16} />
              <Text style={[text.verified, { color: colors.verified }]}>{nb.innstillinger.verified}</Text>
            </View>
          </View>
          <Icon name="right" size={20} color={colors.faint} />
        </Pressable>
      </FadeUp>

      <Sec>{nb.innstillinger.secAccount}</Sec>
      <Group>
        <ListRow
          icon="user"
          title={me.displayName}
          subtitle={nb.innstillinger.accountSub(profile?.memberSince ?? '')}
          chevron
          onPress={() => safePush('/profil/rediger')}
        />
        <ListRow
          icon="phone"
          title={nb.innstillinger.phone}
          subtitle={profile?.phone ?? nb.innstillinger.notSet}
          right={verified('PHONE') && profile?.phone ? <Pill label={nb.innstillinger.confirmed} tone="ok" icon="check" size="sm" /> : undefined}
          onPress={() => safePush('/verifisering')}
        />
        <ListRow
          icon="mail"
          title={nb.innstillinger.email}
          subtitle={settings?.email ?? nb.innstillinger.notSet}
          right={verified('EMAIL') && settings?.email ? <Pill label={nb.innstillinger.confirmed} tone="ok" icon="check" size="sm" /> : undefined}
          onPress={() => safePush('/verifisering')}
        />
      </Group>

      <Sec>{nb.innstillinger.secPlace}</Sec>
      <Group>
        <ListRow
          icon="pin"
          iconBg={colors.limeTint}
          iconColor={colors.limeDeep}
          title={municipality ? nb.innstillinger.kommune(municipality) : nb.innstillinger.pickKommune}
          subtitle={nb.oppdrag.reach[reach].name}
          right={<Text style={text.meta}>{nb.innstillinger.change}</Text>}
          chevron
          onPress={() => setLocOpen(true)}
        />
      </Group>

      <Sec>{nb.innstillinger.secNotif}</Sec>
      <Group>
        <ListRow
          icon="bell"
          title={nb.innstillinger.push}
          subtitle={nb.innstillinger.pushSub}
          right={
            <Toggle
              value={!!settings?.notificationPrefs.channels.push}
              onValueChange={(v) => setChannel('push', v)}
              disabled={!settings}
              accessibilityLabel={nb.innstillinger.push}
            />
          }
        />
        <ListRow
          icon="mail"
          title={nb.innstillinger.mail}
          subtitle={nb.innstillinger.mailSub}
          right={
            <Toggle
              value={!!settings?.notificationPrefs.channels.email}
              onValueChange={(v) => setChannel('email', v)}
              disabled={!settings}
              accessibilityLabel={`${nb.innstillinger.mail}-varsler`}
            />
          }
        />
        <ListRow icon="sliders" title={nb.innstillinger.more} subtitle={nb.innstillinger.moreSub} chevron onPress={() => safePush('/varslinger')} />
      </Group>

      <Sec>{nb.innstillinger.secFerie}</Sec>
      <Group>
        <ListRow
          icon="sun"
          iconBg={colors.warnTint}
          iconColor={colors.warn}
          title={nb.innstillinger.ferie}
          subtitle={nb.innstillinger.ferieSub}
          right={<Toggle value={paused} onValueChange={setFerie} disabled={update.isPending || !profile} accessibilityLabel={nb.innstillinger.ferie} />}
        />
      </Group>
      <View style={styles.px}>
        <Text style={styles.xp}>{nb.innstillinger.ferieInfo}</Text>
        {paused ? (
          <FadeUp style={styles.ferie}>
            <Icon name="eye" size={18} color={colors.warn} />
            <Text style={styles.ferieText}>{nb.innstillinger.ferieActive(hidden)}</Text>
          </FadeUp>
        ) : null}
      </View>

      <Sec>{nb.innstillinger.secText}</Sec>
      <View style={styles.px}>
        <View style={[styles.card, styles.pad, styles.gap14, shadow.card]}>
          <Segmented
            accessibilityLabel={nb.innstillinger.secText}
            value={big ? 'big' : 'std'}
            onChange={(v) => setBig(v === 'big')}
            options={[
              { value: 'std', label: nb.innstillinger.textStd },
              { value: 'big', label: nb.innstillinger.textBig },
            ]}
          />
          <View style={styles.row12}>
            <View style={styles.aa}>
              <Text style={styles.aaText}>Aa</Text>
            </View>
            <Text style={[styles.demo, big && styles.demoBig]}>{nb.innstillinger.textDemo}</Text>
          </View>
          {big ? (
            <FadeUp style={styles.gap8}>
              <Text style={text.meta}>{nb.innstillinger.textBigNote}</Text>
              {Platform.OS !== 'web' ? (
                <Button
                  label={nb.innstillinger.textOpenSettings}
                  variant="ghost"
                  size="sm"
                  icon="gear"
                  block={false}
                  onPress={() => Linking.openSettings().catch(() => undefined)}
                />
              ) : null}
            </FadeUp>
          ) : null}
        </View>
      </View>

      <Sec>{nb.innstillinger.secPrivacy}</Sec>
      <Group>
        <ListRow icon="lock" title={nb.innstillinger.privacy} subtitle={nb.innstillinger.privacySub} chevron onPress={() => safePush('/personvern')} />
        <ListRow icon="file" title={nb.innstillinger.terms} subtitle={nb.innstillinger.termsSub} chevron onPress={() => safePush('/vilkar')} />
        {flags.businessRegistration ? (
          <ListRow
            icon="building"
            iconBg={colors.cyanTint}
            iconColor={colors.cyanDeep}
            title={nb.innstillinger.business}
            subtitle={nb.innstillinger.businessSub}
            chevron
            onPress={() => safePush('/bedrift')}
          />
        ) : null}
      </Group>

      {showDev ? (
        <>
          <Sec>{nb.innstillinger.secDev}</Sec>
          <Group>
            <ListRow
              icon="key"
              title={nb.innstillinger.dev}
              subtitle={nb.innstillinger.devSub}
              right={
                <Toggle
                  value={dev}
                  onValueChange={(v) => {
                    setDev(v);
                    toast.success(v ? nb.innstillinger.devOn : nb.innstillinger.devOff, { icon: v ? 'key' : 'x' });
                  }}
                  accessibilityLabel={nb.innstillinger.dev}
                  testID={DEV_KEY}
                />
              }
            />
          </Group>
          {dev ? (
            <FadeUp style={[styles.px, styles.mt10]}>
              <View style={styles.devCard}>
                <View style={styles.devGlow} />
                <View style={styles.devHead}>
                  <Text style={styles.devTitle}>{nb.innstillinger.flags}</Text>
                  <View style={styles.devPill}>
                    <Text style={styles.devPillText}>{nb.innstillinger.flagsOn(flagKeys.filter((f) => flags[f]).length)}</Text>
                  </View>
                </View>
                {flagKeys.map((f, i) => (
                  <View key={f} style={[styles.flag, i > 0 && styles.flagDivider]}>
                    <View style={styles.flex}>
                      <Text style={styles.flagLabel}>{FLAG_META[f].label}</Text>
                      <Text style={styles.code}>{FLAG_META[f].code}</Text>
                    </View>
                    <Toggle
                      value={flags[f]}
                      onValueChange={(v) => {
                        setFlagOverride(f, v);
                        toast.success(nb.innstillinger.flagToast(FLAG_META[f].label, v), { icon: 'zap' });
                      }}
                      accessibilityLabel={FLAG_META[f].label}
                    />
                  </View>
                ))}
                <View style={styles.devFoot}>
                  <Text style={styles.code}>{nb.innstillinger.env(ENV.useMocks ? 'demo' : __DEV__ ? 'test' : 'prod')}</Text>
                  <Text style={styles.code}>{nb.innstillinger.build(version)}</Text>
                </View>
              </View>
            </FadeUp>
          ) : null}
        </>
      ) : null}

      <View style={[styles.px, styles.actions]}>
        <Button label={nb.innstillinger.logout} variant="ghost" icon="logout" onPress={() => setLogout(true)} />
        <Button label={nb.innstillinger.deleteAccount} variant="dangerGhost" icon="trash" onPress={() => safePush('/slett-konto')} />
        <Text style={[text.meta, styles.version]}>{nb.innstillinger.version(version)}</Text>
      </View>
      <View style={styles.bottom} />

      <LocationSheet visible={locOpen} onClose={() => setLocOpen(false)} kommune={municipality} reach={reach} onApply={applyLocation} />
      <Dialog
        visible={logout}
        onClose={() => setLogout(false)}
        icon="logout"
        tone="neutral"
        title={nb.innstillinger.logoutTitle}
        body={nb.innstillinger.logoutBody}
        actions={
          <View style={styles.gap10}>
            <Button label={nb.innstillinger.logout} variant="ink" onPress={doLogout} />
            <Button label={nb.innstillinger.cancel} variant="ghost" onPress={() => setLogout(false)} />
          </View>
        }
      />
    </Screen>
  );
}

function Sec({ children }: { children: string }) {
  return <Text style={[text.eyebrow, styles.sec]}>{children}</Text>;
}

function Group({ children }: { children: ReactNode }) {
  return (
    <View style={styles.px}>
      <ListGroup style={shadow.card}>{children}</ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap14: { gap: 14 },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottom: { height: 60 },
  sec: { paddingHorizontal: screenPadding, marginTop: 26, marginBottom: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card },
  pad: { padding: 18 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  pname: { fontFamily: fonts.display, fontSize: 20, lineHeight: 22, letterSpacing: -0.4, color: colors.ink },
  vbadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  xp: { marginTop: 10, marginHorizontal: 4, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.mute },
  ferie: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.m, backgroundColor: colors.warnTint },
  ferieText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, lineHeight: 19, color: colors.warn },
  aa: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  aaText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  demo: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink2 },
  demoBig: { fontSize: 19, lineHeight: 26 },
  devCard: { backgroundColor: colors.ink, borderRadius: 22, padding: 16, overflow: 'hidden' },
  devGlow: { position: 'absolute', right: -60, top: -70, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.lime, opacity: 0.22 },
  devHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  devTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.white },
  devPill: { height: 22, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.onInk12, justifyContent: 'center' },
  devPillText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lime },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  flagDivider: { borderTopWidth: 1, borderTopColor: colors.onInk10 },
  flagLabel: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.white, marginBottom: 5 },
  code: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 11.5, color: colors.onInk55 },
  devFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.onInk10 },
  actions: { gap: 10, marginTop: 30 },
  version: { textAlign: 'center', marginTop: 10 },
});
