import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useProfile, useUpdateProfile } from '@/api/queries';
import { profileRepository } from '@/data/profileRepository';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { AppText } from '@/components/ui/Text';

export function EditProfileScreen() {
  const router = useRouter();
  const id = profileRepository.currentUserId;
  const { data: profile } = useProfile(id);
  const update = useUpdateProfile();

  const [name, setName] = useState(profile?.displayName ?? '');
  const [place, setPlace] = useState(profile?.location.place ?? '');
  const [presentation, setPresentation] = useState(profile?.presentation ?? '');

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
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
