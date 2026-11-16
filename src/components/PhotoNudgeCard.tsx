import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUpdateProfile } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import nb from '@/i18n/nb';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { pickAndUpload } from '@/lib/uploads';
import { colors, shadow, text } from '@/theme/theme';
import { Avatar, Button, FadeUp, Icon, Sheet, Spinner, type IconName } from './ui';

const SNOOZE_KEY = 'minnabo.photoNudge.until';
/** «Senere» hides the card this long. */
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * «Vis naboene hvem du er» on Oppdrag, for someone without a profile picture (asked 2026-11-09).
 * The picture is saved straight away; «Senere» hides the card for 14 days. Nothing for the youth app
 * (it has its own on Profil) or before onboarding is done.
 */
export function PhotoNudgeCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const me = useCurrentUser();
  const update = useUpdateProfile();
  const [snoozed, setSnoozed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SNOOZE_KEY)
      .then((v) => alive && setSnoozed(!!v && Number(v) > Date.now()))
      .catch(() => alive && setSnoozed(false));
    return () => {
      alive = false;
    };
  }, []);

  const later = useCallback(() => {
    setSnoozed(true);
    haptics.light();
    void AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)).catch(() => undefined);
  }, []);

  if (snoozed !== false || !me.id || !me.onboardedAt || me.isYouth || me.avatarUrl) return null;

  const pick = async (source: 'camera' | 'library') => {
    setOpen(false);
    setBusy(true);
    try {
      const res = await pickAndUpload({ bucket: 'avatars', folder: me.id, source });
      if (!res) {
        setBusy(false);
        return;
      }
      update.mutate(
        { avatarPath: res.path },
        {
          onSuccess: () => {
            haptics.success();
            toast.success(nb.photoNudge.saved, { icon: 'check' });
          },
          onError: (e) => toast.error(serverMessage(e, nb.toast.avatarFailed)),
          onSettled: () => setBusy(false),
        },
      );
    } catch (e) {
      setBusy(false);
      toast.error(serverMessage(e, nb.toast.avatarFailed));
    }
  };

  return (
    <View style={style}>
      <FadeUp style={[styles.card, shadow.card]} testID="photo-nudge">
        <View style={styles.top}>
          <View style={styles.art}>
            <View style={styles.ring} />
            <Avatar initials={me.initials} seed={me.id} size={48} ring={false} />
            <View style={styles.badge}>{busy ? <Spinner size={12} color={colors.ink} /> : <Icon name="camera" size={13} color={colors.ink} />}</View>
            <View style={styles.dot} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{nb.photoNudge.title}</Text>
            <Text style={text.roleDesc}>{nb.photoNudge.body}</Text>
          </View>
        </View>
        <View style={styles.btns}>
          <Button label={nb.photoNudge.later} variant="ghost" size="sm" block={false} onPress={later} style={styles.btn} />
          <Button label={nb.photoNudge.add} icon="camera" size="sm" block={false} loading={busy} onPress={() => setOpen(true)} style={styles.btn15} />
        </View>
      </FadeUp>
      <Sheet visible={open} onClose={() => setOpen(false)} title={nb.editProfile.photoSheetTitle} titleSize="h2">
        <Text style={[text.meta, styles.sub]}>{nb.photoNudge.sheetHint}</Text>
        <View style={styles.rows}>
          <Row icon="camera" bg={colors.limeTint} fg={colors.limeDeep} label={nb.editProfile.takePhoto} onPress={() => void pick('camera')} />
          <Row icon="image" bg={colors.cyanTint} fg={colors.cyanDeep} label={nb.editProfile.pickAlbum} onPress={() => void pick('library')} />
        </View>
      </Sheet>
    </View>
  );
}

function Row({ icon, bg, fg, label, onPress }: { icon: IconName; bg: string; fg: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <Text style={text.rowTitle}>{label}</Text>
    </Pressable>
  );
}

const ART = 64;

const styles = StyleSheet.create({
  card: { borderRadius: 24, backgroundColor: colors.white, padding: 14, gap: 12, borderWidth: 1.5, borderColor: colors.limeTint },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  art: { width: ART, height: ART, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: ART, height: ART, borderRadius: ART / 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lime, backgroundColor: colors.limeTint },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.lime,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 2, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cyan },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: text.roleTitle,
  btns: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1 },
  btn15: { flex: 1.5 },
  sub: { marginBottom: 14 },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 4 },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});
