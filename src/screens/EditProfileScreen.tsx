import { useEffect, useState } from 'react';
import { ScrollView, View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useSession } from '@/auth/session';
import { useProfile, useUpdateProfile } from '@/api/queries';
import { pickAndUpload } from '@/lib/uploads';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ImagePickerField } from '@/components/ui/ImagePickerField';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PageHeader } from '@/components/TopBar';
import { FallbackScreen } from '@/components/FallbackScreen';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { AppText } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';

export function EditProfileScreen() {
  const router = useRouter();
  const { userId } = useSession();
  const { data: profile, isLoading, isError, refetch } = useProfile(userId ?? '');
  const update = useUpdateProfile();

  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [presentation, setPresentation] = useState('');
  const [homeNotes, setHomeNotes] = useState('');
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; place?: string }>({});

  useEffect(() => {
    if (profile && !hydrated) {
      setName(profile.displayName);
      setPlace(profile.location.place);
      setPresentation(profile.presentation ?? '');
      setHomeNotes(profile.homeNotes ?? '');
      setPortfolio(profile.portfolio ?? []);
      setAvatarUrl(profile.avatarUrl);
      setHydrated(true);
    }
  }, [profile, hydrated]);

  // Don't render the form over a profile we couldn't load — saving it would
  // overwrite the real profile with empty strings.
  if (!hydrated && (isLoading || isError || !profile)) {
    return (
      <FallbackScreen
        status={isError ? 'error' : 'loading'}
        onRetry={() => refetch()}
        title={nb.profile.editTitle}
      />
    );
  }

  const changeAvatar = async () => {
    if (!userId) return;
    const previous = avatarUrl;
    setAvatarBusy(true);
    try {
      const res = await pickAndUpload({ bucket: 'avatars', folder: userId, source: 'library' });
      if (!res) return; // user cancelled
      setAvatarUrl(res.publicUrl);
      try {
        await update.mutateAsync({ avatarPath: res.path });
        haptics.success();
        toast.success(nb.toast.avatarUpdated);
      } catch {
        setAvatarUrl(previous); // roll back the preview — it wasn't saved
        toast.error(nb.toast.avatarFailed);
      }
    } catch {
      toast.error(nb.toast.avatarFailed);
    } finally {
      setAvatarBusy(false);
    }
  };

  const save = () => {
    const trimmedName = name.trim();
    const trimmedPlace = place.trim();
    const nextErrors: { name?: string; place?: string } = {};
    if (!trimmedName) nextErrors.name = nb.profile.nameRequired;
    if (!trimmedPlace) nextErrors.place = nb.profile.areaRequired;
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.place) {
      haptics.warning();
      return;
    }

    update.mutate(
      {
        displayName: trimmedName,
        place: trimmedPlace,
        presentation: presentation.trim(),
        homeNotes: homeNotes.trim(),
        portfolio,
      },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(nb.toast.profileSaved);
          router.back();
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  return (
    <KeyboardAvoider>
      <PageHeader title={nb.profile.editTitle} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{nb.profile.editTitle}</ScreenTitle>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.profile.changePhoto}
          onPress={changeAvatar}
          disabled={avatarBusy}
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

        <TextField
          label={nb.profile.fieldName}
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
          }}
          error={errors.name}
        />
        <TextField
          label={nb.profile.fieldArea}
          value={place}
          onChangeText={(t) => {
            setPlace(t);
            if (errors.place) setErrors((e) => ({ ...e, place: undefined }));
          }}
          error={errors.place}
          hint={errors.place ? undefined : 'Vis bare omtrentlig sted offentlig.'}
        />
        <TextField
          label={nb.profile.fieldPresentation}
          value={presentation}
          onChangeText={setPresentation}
          multiline
        />
        <TextField
          label={nb.profile.fieldHomeNotes}
          value={homeNotes}
          onChangeText={setHomeNotes}
          hint={nb.profile.homeNotesHint}
          multiline
        />

        <View style={{ gap: 6 }}>
          <SectionHeader title={nb.profile.portfolioTitle} />
          <AppText variant="meta" color="navyMuted">
            {nb.profile.portfolioHint}
          </AppText>
          <ImagePickerField value={portfolio} onChange={setPortfolio} />
        </View>
        {update.isError ? (
          <AppText variant="meta" color="dangerText">
            {nb.state.error}
          </AppText>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={nb.profile.save} onPress={save} loading={update.isPending} />
      </View>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
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
