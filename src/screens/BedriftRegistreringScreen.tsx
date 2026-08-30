import { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { CATEGORIES as categories } from '@/domain/categories';
import { useSubmitBusinessProfile } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { PickerPills } from '@/components/ui/PickerPills';
import { Button } from '@/components/ui/Button';
import { InfoBox } from '@/components/ui/InfoBox';

export function BedriftRegistreringScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const [orgNr, setOrgNr] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submitBiz = useSubmitBusinessProfile();

  useEffect(() => {
    if (me.displayName) setContact((c) => c || me.displayName);
  }, [me.displayName]);

  const submit = () => {
    if (!/^\d{9}$/.test(orgNr.replace(/\s/g, ''))) {
      setError(nb.bedrift.errOrgNr);
      return;
    }
    if (!name.trim() || !contact.trim() || !email.trim()) {
      setError(nb.bedrift.errRequired);
      return;
    }
    setError(null);
    submitBiz.mutate(
      {
        orgNr: orgNr.replace(/\s/g, ''),
        companyName: name.trim(),
        contactPerson: contact.trim(),
        email: email.trim(),
        phone: phone.trim(),
        categorySlugs: cats,
      },
      {
        onSuccess: () => setDone(true),
        onError: () => setError(nb.state.error),
      },
    );
  };

  if (done) {
    return (
      <KeyboardAvoider>
        <PageHeader title={nb.bedrift.title} showBack={false} />
        <View style={styles.center}>
          <View style={styles.badge}>
            <Icon name="check" size={30} color="white" />
          </View>
          <ScreenTitle>{nb.bedrift.submitted}</ScreenTitle>
          <AppText variant="body" color="navyMuted" align="center">
            {nb.bedrift.submittedBody}
          </AppText>
          <Button label={nb.leggUt.toFront} onPress={() => router.replace('/')} />
        </View>
      </KeyboardAvoider>
    );
  }

  return (
    <KeyboardAvoider>
      <PageHeader title={nb.bedrift.title} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{nb.bedrift.heading}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {nb.bedrift.sub}
        </AppText>

        <TextField
          label={nb.bedrift.orgNr}
          value={orgNr}
          onChangeText={setOrgNr}
          keyboardType="numeric"
          maxLength={11}
          hint={nb.bedrift.orgNrHint}
        />
        <TextField label={nb.bedrift.companyName} value={name} onChangeText={setName} />
        <TextField label={nb.bedrift.contactPerson} value={contact} onChangeText={setContact} />
        <TextField label={nb.bedrift.contactEmail} value={email} onChangeText={setEmail} />
        <TextField label={nb.bedrift.contactPhone} value={phone} onChangeText={setPhone} keyboardType="numeric" />

        <View style={styles.catGroup}>
          <AppText variant="meta" weight="bold">
            {nb.bedrift.categoriesLabel}
          </AppText>
          <PickerPills
            options={categories.map((c) => ({ value: c.slug, label: c.label }))}
            selected={cats}
            onToggle={(v) => setCats((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
            showCheck
          />
        </View>

        {error ? (
          <AppText variant="meta" color="dangerText">
            {error}
          </AppText>
        ) : null}

        <InfoBox icon="shield">
          Vi kontrollerer organisasjonsnummer og kontaktperson i Brønnøysundregistrene.
        </InfoBox>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={nb.bedrift.submit} onPress={submit} iconRight="send" loading={submitBiz.isPending} />
      </View>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxl },
  catGroup: { gap: tokens.space.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xxl,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
