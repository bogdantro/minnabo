import { useEffect, useState } from 'react';
import { ScrollView, View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useSession } from '@/auth/session';
import { useProfile, useUpdateProfile } from '@/api/queries';
import { pickAndUpload } from '@/lib/uploads';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { AppText } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';

export function EditProfileScreen() {
  const router = useRouter();
  const { userId } = useSession();
  const { data: profile } = useProfile(userId ?? '');
  const update = useUpdateProfile();

  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [presentation, setPresentation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profile && !hydrated) {
      setName(profile.displayName);
      setPlace(profile.location.place);
      setPresentation(profile.presentation ?? '');
      setAvatarUrl(profile.avatarUrl);
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const changeAvatar = async () => {
    if (!userId) return;
    setAvatarBusy(true);
    try {
      const res = await pickAndUpload({ bucket: 'avatars', folder: userId, source: 'library' });
      if (res) {
        setAvatarUrl(res.publicUrl);
        update.mutate({ avatarPath: res.path });
      }
    } catch {
      // surfaced via update.isError / ignored on cancel
    } finally {
      setAvatarBusy(false);
    }
  };

  const save = () => {
    update.mutate(
      { displayName: name.trim(), place: place.trim(), presentation: presentation.trim() },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.profile.editTitle} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{nb.profile.editTitle}</ScreenTitle>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.profile.changePhoto}
          onPress={changeAvatar}
          style={styles.avatarRow}
        >
          <Avatar uri={avatarUrl} initials={profile?.initials ?? 'N'} size={64} />
          <View style={styles.avatarText}>
            <AppText variant="cardTitle" weight="bold">
              {nb.profile.changePhoto}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              JPG, PNG eller WEBP · maks 8 MB
            </AppText>
          </View>
          {avatarBusy ? (
            <ActivityIndicator color={tokens.color.cyan} />
          ) : (
            <Icon name="camera" size={18} color="cyan" />
          )}
        </Pressable>

        <TextField label={nb.profile.fieldName} value={name} onChangeText={setName} />
        <TextField
          label={nb.profile.fieldArea}
          value={place}
          onChangeText={setPlace}
          hint="Vis bare omtrentlig sted offentlig."
        />
        <TextField
          label={nb.profile.fieldPresentation}
          value={presentation}
          onChangeText={setPresentation}
          multiline
        />
        {update.isError ? (
          <AppText variant="meta" color="dangerText">
            {nb.state.error}
          </AppText>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={nb.profile.save} onPress={save} loading={update.isPending} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxl },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.card,
    padding: tokens.space.md,
  },
  avatarText: { flex: 1, gap: 2 },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
