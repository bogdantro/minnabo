import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_NOTIFICATION_PREFS, type NotifKey, type NotificationPrefs } from '@/api/ApiClient';
import nb from '@/i18n/nb';
import { useMySettings, useUpdateNotificationPrefs } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { haptics } from '@/lib/haptics';
import { sendTestNotification } from '@/lib/notifications';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Button, FadeUp, Icon, Note, Screen, SubHeader, Toggle, type IconName } from '@/components/ui';

const FROM_OPTS = ['20:00', '21:00', '22:00', '23:00'];
const TO_OPTS = ['06:00', '07:00', '08:00', '09:00'];
const KEYS = Object.keys(DEFAULT_NOTIFICATION_PREFS.push) as NotifKey[];

/** Varslinger (design/screens/Varslinger.dc.html) – stored in profile_settings, saved on every change. */
export function NotificationPrefsScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: settings } = useMySettings();
  const save = useUpdateNotificationPrefs();
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);
  const prefs = settings?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS;
  const ready = !!settings;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/innstillinger'));
  const commit = (next: NotificationPrefs, msg: string = nb.varslinger.saved, icon: IconName = 'check') =>
    save.mutate(next, {
      onSuccess: () => toast.success(msg, { icon }),
      onError: () => toast.error(nb.toast.genericError),
    });

  const flip = (ch: 'push' | 'email', key: NotifKey) => {
    haptics.light();
    commit({ ...prefs, [ch]: { ...prefs[ch], [key]: !prefs[ch][key] } });
  };

  const pCount = KEYS.filter((k) => prefs.push[k]).length;
  const eCount = KEYS.filter((k) => prefs.email[k]).length;
  const h = (t: string) => parseInt(t, 10);
  const f = h(prefs.quiet.from);
  const t = h(prefs.quiet.to);
  const pct = (x: number) => `${(x / 24) * 100}%` as const;
  const segs: { left: number; width: number }[] = f > t ? [{ left: f, width: 24 - f }, { left: 0, width: t }] : [{ left: f, width: t - f }];

  const test = async () => {
    const ok = await sendTestNotification(nb.varslinger.testTitle, nb.varslinger.testBody);
    if (ok) toast.success(nb.varslinger.testSent, { icon: 'send' });
    else toast.info(nb.varslinger.testUnavailable, { icon: 'info' });
  };

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.varslinger.title} onBack={back} />}>
      <FadeUp style={[styles.px, styles.head]}>
        <Text style={text.h1} accessibilityRole="header">
          {nb.varslinger.heading}
        </Text>
        <Text style={[text.body, styles.ink2]}>{nb.varslinger.lead}</Text>
      </FadeUp>

      <FadeUp delay={60} style={[styles.px, styles.mt18]}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: prefs.master }}
          accessibilityLabel={nb.varslinger.master}
          disabled={!ready}
          onPress={() =>
            commit({ ...prefs, master: !prefs.master }, prefs.master ? nb.varslinger.masterOff : nb.varslinger.masterOn, prefs.master ? 'pause' : 'bell')
          }
          style={[styles.card, styles.masterCard, shadow.card]}
        >
          <View style={styles.masterIcon}>
            <Icon name="bell" size={22} color={colors.lime} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.masterTitle}>{nb.varslinger.master}</Text>
            <Text style={text.meta}>{prefs.master ? nb.varslinger.masterSub(pCount, eCount) : nb.varslinger.paused}</Text>
          </View>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Toggle value={prefs.master} onValueChange={() => undefined} accessibilityLabel={nb.varslinger.master} />
          </View>
        </Pressable>
      </FadeUp>
      {!prefs.master ? (
        <FadeUp style={[styles.px, styles.mt10]}>
          <View style={styles.pausedNote}>
            <Icon name="alert" size={18} color={colors.warn} />
            <Text style={styles.pausedText}>{nb.varslinger.pausedNote}</Text>
          </View>
        </FadeUp>
      ) : null}

      {nb.varslinger.groups.map((g, gi) => (
        <FadeUp key={g.title} delay={100 + gi * 40}>
          <View style={styles.grp}>
            <Icon name={g.icon as IconName} size={18} color={colors.mute} />
            <Text style={text.eyebrow}>{g.title}</Text>
          </View>
          <View style={styles.px}>
            <View style={[styles.mx, shadow.card, !prefs.master && styles.mxOff]} pointerEvents={prefs.master ? 'auto' : 'none'}>
              <View style={styles.mxh}>
                <Text style={[styles.mxhText, styles.flex]}>{nb.varslinger.colLabel}</Text>
                <Text style={[styles.mxhText, styles.col]}>{nb.varslinger.colPush}</Text>
                <Text style={[styles.mxhText, styles.col]}>{nb.varslinger.colEmail}</Text>
              </View>
              {g.rows.map((r, i) => {
                const key = r.key as NotifKey;
                const sub = key === 'board' && me.place ? nb.varslinger.boardSub(me.place) : r.sub;
                return (
                  <View key={r.key} style={[styles.mxr, i > 0 && styles.mxrDivider]}>
                    <View style={styles.flex}>
                      <Text style={styles.rowLabel}>{r.label}</Text>
                      <Text style={styles.rowSub}>{sub}</Text>
                    </View>
                    <View style={styles.col}>
                      <Toggle size="sm" value={prefs.push[key]} onValueChange={() => flip('push', key)} disabled={!ready} accessibilityLabel={nb.varslinger.pushAria(r.label)} />
                    </View>
                    <View style={styles.col}>
                      <Toggle size="sm" value={prefs.email[key]} onValueChange={() => flip('email', key)} disabled={!ready} accessibilityLabel={nb.varslinger.emailAria(r.label)} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </FadeUp>
      ))}

      <View style={styles.grp}>
        <Icon name="moon" size={18} color={colors.mute} />
        <Text style={text.eyebrow}>{nb.varslinger.quietTitle}</Text>
      </View>
      <View style={styles.px}>
        <View style={[styles.card, shadow.card]}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: prefs.quiet.on }}
            accessibilityLabel={nb.varslinger.quietTitle}
            disabled={!ready}
            onPress={() => {
              setEditing(null);
              commit({ ...prefs, quiet: { ...prefs.quiet, on: !prefs.quiet.on } });
            }}
            style={styles.quietHead}
          >
            <View style={styles.quietIcon}>
              <Icon name="moon" size={18} color={colors.lavender} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.quietTitle}>{nb.varslinger.quietTitle}</Text>
              <Text style={text.meta}>{nb.varslinger.quietSub}</Text>
            </View>
            <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Toggle value={prefs.quiet.on} onValueChange={() => undefined} accessibilityLabel={nb.varslinger.quietTitle} />
            </View>
          </Pressable>
          {prefs.quiet.on ? (
            <FadeUp style={styles.quietBody}>
              <View style={styles.row10}>
                {(['from', 'to'] as const).map((which) => (
                  <Pressable
                    key={which}
                    accessibilityRole="button"
                    accessibilityLabel={which === 'from' ? nb.varslinger.editFrom : nb.varslinger.editTo}
                    accessibilityState={{ expanded: editing === which }}
                    onPress={() => setEditing(editing === which ? null : which)}
                    style={[styles.tchip, editing === which && styles.tchipOn]}
                  >
                    <Text style={styles.tchipSmall}>{which === 'from' ? nb.varslinger.from : nb.varslinger.to}</Text>
                    <Text style={styles.tchipBig}>{prefs.quiet[which]}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.gap6}>
                <View style={styles.night}>
                  {segs.map((s, i) => (
                    <View key={i} style={[styles.nightSeg, { left: pct(s.left), width: pct(s.width) }]} />
                  ))}
                </View>
                <View style={styles.between}>
                  {['00', '06', '12', '18', '24'].map((x) => (
                    <Text key={x} style={text.meta}>
                      {x}
                    </Text>
                  ))}
                </View>
              </View>
              {editing ? (
                <FadeUp style={styles.gap8}>
                  <Text style={text.label}>{editing === 'from' ? nb.varslinger.quietFrom : nb.varslinger.quietTo}</Text>
                  <View style={styles.row8}>
                    {(editing === 'to' ? TO_OPTS : FROM_OPTS).map((o) => {
                      const on = prefs.quiet[editing] === o;
                      return (
                        <Pressable
                          key={o}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          onPress={() => {
                            const quiet = { ...prefs.quiet, [editing]: o };
                            setEditing(null);
                            commit({ ...prefs, quiet }, nb.varslinger.quietSaved(quiet.from, quiet.to), 'moon');
                          }}
                          style={[styles.topt, on && styles.toptOn]}
                        >
                          <Text style={[styles.toptText, on && styles.white]}>{o}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </FadeUp>
              ) : null}
              <Note icon="info">{nb.varslinger.quietNote}</Note>
            </FadeUp>
          ) : null}
        </View>
      </View>

      <View style={[styles.px, styles.mt22]}>
        <Button label={nb.varslinger.test} variant="ghost" icon="send" onPress={test} />
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  head: { marginTop: 8, gap: 8 },
  ink2: { color: colors.ink2 },
  white: { color: colors.white },
  mt10: { marginTop: 10 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  row8: { flexDirection: 'row', gap: 8 },
  row10: { flexDirection: 'row', gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  bottom: { height: 90 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  masterCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  masterIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  masterTitle: { fontFamily: fonts.display, fontSize: 17, letterSpacing: -0.34, color: colors.ink, marginBottom: 3 },
  pausedNote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.m, backgroundColor: colors.warnTint },
  pausedText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, lineHeight: 19, color: colors.warn },
  grp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: screenPadding, marginTop: 24, marginBottom: 10 },
  mx: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  mxOff: { opacity: 0.42 },
  mxh: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 10, paddingLeft: 16, paddingRight: 6, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  mxhText: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 0.69, textTransform: 'uppercase', color: colors.mute },
  col: { width: 62, alignItems: 'center', textAlign: 'center' },
  mxr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 16, paddingRight: 6 },
  mxrDivider: { borderTopWidth: 1, borderTopColor: colors.line2, marginLeft: 16, paddingLeft: 0 },
  rowLabel: { fontFamily: fonts.bodySemi, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.mute, marginTop: 2 },
  quietHead: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  quietIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lavenderTint, alignItems: 'center', justifyContent: 'center' },
  quietTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.ink, marginBottom: 3 },
  quietBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  tchip: { flex: 1, height: 64, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, justifyContent: 'center', gap: 4, paddingHorizontal: 16 },
  tchipOn: { borderColor: colors.ink, ...shadow.selected },
  tchipSmall: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: colors.mute },
  tchipBig: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.44, color: colors.ink },
  night: { height: 14, borderRadius: 7, backgroundColor: colors.limeTint, overflow: 'hidden' },
  nightSeg: { position: 'absolute', top: 0, bottom: 0, borderRadius: 7, backgroundColor: colors.ink },
  topt: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  toptOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  toptText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink2 },
});
