import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUpdateProfile } from '@/api/queries';
import nb from '@/i18n/nb';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { pickAndUpload } from '@/lib/uploads';
import { colors, radius, text } from '@/theme/theme';
import { Avatar, Icon, Sheet, Spinner, type IconName } from '@/components/ui';

/**
 * The youth account's profile picture on Profil. A tap opens camera, album or «Fjern bilde», and the
 * choice is saved at once: the youth app has no «Rediger profil» page with a save button.
 */
export function YouthPhoto({ userId, initials, uri }: { userId: string; initials: string; uri?: string }) {
  const update = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = (avatarPath: string | null, done: string, icon: IconName) =>
    update.mutate(
      { avatarPath },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(done, { icon });
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.avatarFailed)),
        onSettled: () => setBusy(false),
      },
    );

  const pick = async (source: 'camera' | 'library') => {
    setOpen(false);
    if (!userId) return;
    setBusy(true);
    try {
      const res = await pickAndUpload({ bucket: 'avatars', folder: userId, source });
      if (!res) {
        setBusy(false);
        return;
      }
      save(res.path, source === 'camera' ? nb.youth.photoTaken : nb.youth.photoPicked, source === 'camera' ? 'camera' : 'image');
    } catch (e) {
      setBusy(false);
      toast.error(serverMessage(e, nb.toast.avatarFailed));
    }
  };

  const remove = () => {
    setOpen(false);
    setBusy(true);
    save(null, nb.editProfile.photoRemovedToast, 'trash');
  };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={nb.editProfile.changePhoto} onPress={() => setOpen(true)} disabled={busy} style={styles.wrap}>
        <Avatar initials={initials} uri={uri} colorKey="b" size={88} />
        <View style={styles.badge}>{busy ? <Spinner size={16} color={colors.ink} /> : <Icon name="camera" size={16} color={colors.ink} />}</View>
      </Pressable>
      {!uri ? <Text style={[text.link, styles.add]} onPress={() => setOpen(true)}>{nb.youth.addPhoto}</Text> : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title={nb.editProfile.photoSheetTitle} titleSize="h2">
        <Text style={[text.meta, styles.sub]}>{nb.youth.photoHint}</Text>
        <View style={styles.rows}>
          <Row icon="camera" bg={colors.limeTint} fg={colors.limeDeep} label={nb.editProfile.takePhoto} onPress={() => void pick('camera')} />
          <Row icon="image" bg={colors.cyanTint} fg={colors.cyanDeep} label={nb.editProfile.pickAlbum} onPress={() => void pick('library')} />
          {uri ? <Row icon="trash" bg={colors.dangerTint} fg={colors.danger} label={nb.editProfile.removePhoto} onPress={remove} /> : null}
        </View>
      </Sheet>
    </>
  );
}

function Row({ icon, bg, fg, label, onPress }: { icon: IconName; bg: string; fg: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <Text style={[text.label, styles.flex, fg === colors.danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: colors.bg,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { fontSize: 14 },
  sub: { marginBottom: 14 },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12, borderRadius: radius.card, backgroundColor: colors.surface2 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});
