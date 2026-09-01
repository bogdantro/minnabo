import { useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useTrustedContacts } from '@/lib/trustedContacts';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export function TrustedContactsScreen() {
  const { contacts, add, remove, full } = useTrustedContacts();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const save = () => {
    if (!name.trim() || !phone.trim()) return;
    add(name, phone);
    setName('');
    setPhone('');
    toast.success(nb.trustedContacts.added);
  };

  const del = async (id: string, label: string) => {
    const ok = await confirm({
      title: `${nb.trustedContacts.remove}?`,
      message: label,
      confirmLabel: nb.trustedContacts.remove,
      destructive: true,
    });
    if (ok) {
      remove(id);
      toast.success(nb.trustedContacts.removed);
    }
  };

  return (
    <KeyboardAvoider>
      <PageHeader title={nb.trustedContacts.title} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{nb.trustedContacts.title}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {nb.trustedContacts.body}
        </AppText>

        {contacts.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="users" size={22} color="navyMuted" />
            <AppText variant="body" color="navyMuted">
              {nb.trustedContacts.empty}
            </AppText>
          </View>
        ) : (
          <View style={styles.list}>
            {contacts.map((c) => (
              <View key={c.id} style={styles.row}>
                <View style={styles.rowIcon}>
                  <Icon name="user" size={18} color="navy" />
                </View>
                <View style={styles.rowBody}>
                  <AppText variant="cardTitle" weight="bold">
                    {c.name}
                  </AppText>
                  <AppText variant="meta" color="navyMuted">
                    {c.phone}
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${nb.trustedContacts.remove} ${c.name}`}
                  hitSlop={8}
                  onPress={() => del(c.id, `${c.name} · ${c.phone}`)}
                >
                  <Icon name="trash-2" size={18} color="dangerText" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {full ? (
          <AppText variant="meta" color="navyMuted">
            {nb.trustedContacts.full}
          </AppText>
        ) : (
          <View style={styles.form}>
            <AppText variant="cardTitle" weight="bold">
              {nb.trustedContacts.add}
            </AppText>
            <TextField label={nb.trustedContacts.name} value={name} onChangeText={setName} />
            <TextField
              label={nb.trustedContacts.phone}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Button label={nb.trustedContacts.save} onPress={save} iconRight="plus" />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxxl },
  list: { gap: tokens.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    ...tokens.shadow.card,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 1 },
  form: {
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.lg,
  },
  empty: { alignItems: 'center', gap: tokens.space.sm, paddingVertical: tokens.space.xl },
});
