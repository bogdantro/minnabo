import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import { STORE } from '@/config/links';
import { WHATS_NEW } from '@/content/whatsNew';
import { isOlderVersion } from '@/domain/appVersion';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { setupQuickActions, clearLive, showLive } from '@/lib/appServices';
import { useSafeTrip } from '@/lib/safeTrip';
import { formatTime } from '@/lib/datetime';
import nb from '@/i18n/nb';
import { colors, radius, text } from '@/theme/theme';
import { Button, Icon, Sheet, StateView, type IconKey } from '@/components/ui';

const appVersion = () => Constants.expoConfig?.version ?? '0.0.0';

/** Stopped until the app is updated: the website raised platform.min_app_version past this build. */
export function needsAppUpdate(minimum: string): boolean {
  return isOlderVersion(appVersion(), minimum);
}

/** «Oppdater appen»: an old build that can't talk to the server any more stops here, kindly. */
export function UpdateScreen() {
  return (
    <View style={styles.fill} accessibilityViewIsModal>
      <StateView
        icon="refresh"
        tone="neutral"
        title={nb.update.title}
        body={nb.update.body}
        actionLabel={nb.update.action}
        onAction={() => void Linking.openURL(Platform.OS === 'ios' ? STORE.ios : STORE.android)}
      />
    </View>
  );
}

const SEEN_KEY = 'minnabo.whatsNewSeen.v1';
/** Someone who just finished Oppsett has seen enough new things for one day. */
const NEW_USER_MS = 24 * 60 * 60 * 1000;
/** Not on top of Vipps, Oppsett or a chat: only where a sheet is welcome. */
const SHOWN_ON = ['/', '/fellesskap', '/innboks'];

/** «Nytt i MinNabo»: once per version, for people who were here before it. */
export function WhatsNewSheet() {
  const me = useCurrentUser();
  const path = usePathname();
  const version = appVersion();
  const entry = WHATS_NEW[version];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!entry || !me.id || !me.onboardedAt || !SHOWN_ON.includes(path)) return;
    let live = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (!live || seen === version) return;
        if (Date.now() - Date.parse(me.onboardedAt!) < NEW_USER_MS) {
          void AsyncStorage.setItem(SEEN_KEY, version);
          return;
        }
        setOpen(true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [entry, me.id, me.onboardedAt, path, version]);

  if (!entry) return null;
  const close = () => {
    setOpen(false);
    void AsyncStorage.setItem(SEEN_KEY, version).catch(() => undefined);
  };
  return (
    <Sheet visible={open} onClose={close} title={nb.whatsNew.title} titleSize="h2" scroll>
      <View style={styles.items}>
        {entry.map((it) => (
          <View key={it.title} style={styles.item}>
            <View style={styles.icon}>
              <Icon name={it.icon as IconKey} size={20} color={colors.limeDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={text.label}>{it.title}</Text>
              <Text style={text.meta}>{it.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <Button label={nb.whatsNew.close} variant="ink" onPress={close} />
    </Sheet>
  );
}

/** Quick actions on the app icon, and Trygg tur on the lock screen. Draws nothing. */
export function AppBridges() {
  const me = useCurrentUser();
  const { trip } = useSafeTrip();
  const signedIn = !!me.id;
  const youth = me.isYouth;
  const tripDue = trip?.dueAt;

  useEffect(() => {
    if (!signedIn) return;
    let stop: (() => void) | undefined;
    void setupQuickActions(youth).then((s) => {
      stop = s;
    });
    return () => stop?.();
  }, [signedIn, youth]);

  useEffect(() => {
    if (tripDue) void showLive('trip', nb.live.tripTitle, nb.live.tripBody(formatTime(tripDue)), '/sikkerhet');
    else void clearLive('trip');
  }, [tripDue]);

  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  items: { gap: 16, marginBottom: 20 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 40, height: 40, borderRadius: radius.m, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
});
