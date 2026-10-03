import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { useTrustedContacts, type TrustedContact } from '@/lib/trustedContacts';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  FadeUp,
  Field,
  Icon,
  IconButton,
  Input,
  Note,
  Screen,
  Sheet,
  SubHeader,
  TextLink,
} from '@/components/ui';

const first = (name: string) => name.split(' ')[0] || name;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
/** "12345678" → "123 45 678" */
const fmtPhone = (digits: string) => digits.replace(/(\d{3})(\d{0,2})(\d{0,3})/, (_m, a, b, c) => [a, b, c].filter(Boolean).join(' '));

/** Trygge kontakter (design/screens/TryggeKontakter.dc.html). */
export function TrustedContactsScreen() {
  const router = useRouter();
  const { contacts, add, remove, full } = useTrustedContacts();
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState<TrustedContact | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/sikkerhet'));

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.trustedContacts.title} onBack={back} />}>
      <View style={[styles.px, styles.stack18, styles.pt8]}>
        <FadeUp style={styles.hero}>
          <View style={styles.c1} />
          <View style={styles.c2} />
          <View style={styles.heroBody}>
            <View style={styles.heroIcon}>
              <Icon name="shield" size={22} color={colors.ink} />
            </View>
            <Text style={styles.heroTitle} accessibilityRole="header">
              {nb.trustedContacts.heroTitle}
            </Text>
            <Text style={styles.heroText}>{nb.trustedContacts.heroBody}</Text>
          </View>
        </FadeUp>

        <View style={styles.between}>
          <Text style={text.h4}>{nb.trustedContacts.yours(contacts.length)}</Text>
          {!full ? <TextLink label={nb.trustedContacts.addLink} icon="plus" onPress={() => setOpen(true)} /> : null}
        </View>

        <View style={styles.stack10}>
          {contacts.map((c) => (
            <Animated.View key={c.id} exiting={FadeOutLeft.duration(350)} layout={LinearTransition.duration(300)}>
              <FadeUp style={[styles.crow, shadow.card]}>
                <Avatar initials={initials(c.name)} seed={c.id} size={48} ring={false} />
                <View style={styles.flex}>
                  <Text style={styles.cname}>{c.name}</Text>
                  <Text style={text.meta}>{[c.relation, c.phone].filter(Boolean).join(' · ')}</Text>
                </View>
                <IconButton icon="trash" iconSize={18} accessibilityLabel={nb.trustedContacts.removeAria(c.name)} onPress={() => setAsk(c)} />
              </FadeUp>
            </Animated.View>
          ))}
          {contacts.length === 0 ? (
            <FadeUp style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="users" size={22} color={colors.limeDeep} />
              </View>
              <Text style={styles.emptyTitle}>{nb.trustedContacts.emptyTitle}</Text>
              <Button label={nb.trustedContacts.emptyAdd} variant="ink" size="sm" block={false} onPress={() => setOpen(true)} />
            </FadeUp>
          ) : null}
          {full ? <Text style={text.meta}>{nb.trustedContacts.full}</Text> : null}
        </View>

        <Note icon="lock">{nb.trustedContacts.note}</Note>
        <Button label={nb.trustedContacts.about} variant="ghost" icon="nav" onPress={() => safePush('/sikkerhet')} />
        <View style={styles.bottom} />
      </View>

      <AddSheet
        visible={open}
        onClose={() => setOpen(false)}
        onAdd={(name, phone, relation) => {
          add(name, phone, relation);
          setOpen(false);
          haptics.success();
          toast.success(nb.trustedContacts.added(first(name)));
        }}
      />

      <Dialog
        visible={!!ask}
        onClose={() => setAsk(null)}
        icon="trash"
        tone="danger"
        title={ask ? nb.trustedContacts.removeTitle(first(ask.name)) : ''}
        body={nb.trustedContacts.removeBody}
        actions={
          <View style={styles.row10}>
            <Button label={nb.trustedContacts.cancel} variant="ghost" onPress={() => setAsk(null)} style={styles.flex} />
            <Button
              label={nb.trustedContacts.remove}
              variant="danger"
              onPress={() => {
                if (ask) remove(ask.id);
                setAsk(null);
                toast.success(nb.trustedContacts.removed);
              }}
              style={styles.flex}
            />
          </View>
        }
      />
    </Screen>
  );
}

function AddSheet({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (name: string, phone: string, relation: string) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState<string>(nb.trustedContacts.relations[0]);
  const [tried, setTried] = useState(false);
  const digits = phone.replace(/\D/g, '');
  const nameOk = name.trim().length >= 2;
  const phoneOk = digits.length === 8;

  const save = () => {
    if (!nameOk || !phoneOk) {
      setTried(true);
      haptics.warning();
      return;
    }
    onAdd(name.trim(), `+47 ${fmtPhone(digits)}`, relation);
    setName('');
    setPhone('');
    setRelation(nb.trustedContacts.relations[0]);
    setTried(false);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={nb.trustedContacts.sheetTitle}>
      <View style={styles.stack16}>
        <Field label={nb.trustedContacts.name} error={tried && !nameOk ? nb.trustedContacts.nameErr : null}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={nb.trustedContacts.namePh}
            error={tried && !nameOk}
            autoComplete="name"
            accessibilityLabel={nb.trustedContacts.name}
          />
        </Field>
        <Field label={nb.trustedContacts.phone} error={tried && !phoneOk ? nb.trustedContacts.phoneErr : null}>
          <Input
            value={phone}
            onChangeText={(t) => setPhone(fmtPhone(t.replace(/\D/g, '').slice(0, 8)))}
            prefix="+47"
            placeholder={nb.trustedContacts.phonePh}
            keyboardType="number-pad"
            inputMode="numeric"
            error={tried && !phoneOk}
            accessibilityLabel={nb.trustedContacts.phone}
          />
        </Field>
        <Field label={nb.trustedContacts.relation}>
          <View style={styles.rel}>
            {nb.trustedContacts.relations.map((r) => (
              <Chip key={r} label={r} size="sm" selected={relation === r} onPress={() => setRelation(r)} />
            ))}
          </View>
        </Field>
        <Button label={nb.trustedContacts.add} variant="lime" size="lg" onPress={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  pt8: { paddingTop: 8 },
  stack10: { gap: 10 },
  stack16: { gap: 16 },
  stack18: { gap: 18 },
  row10: { flexDirection: 'row', gap: 10 },
  bottom: { height: 40 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { overflow: 'hidden', borderRadius: 28, backgroundColor: colors.ink, paddingVertical: 22, paddingHorizontal: 20 },
  c1: { position: 'absolute', right: -40, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: colors.lime, opacity: 0.9 },
  c2: { position: 'absolute', right: 60, bottom: -60, width: 110, height: 110, borderRadius: 55, backgroundColor: colors.cyan, opacity: 0.35 },
  heroBody: { gap: 10, maxWidth: 250 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 24, letterSpacing: -0.42, color: colors.white },
  heroText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20.3, color: colors.onInk78 },
  crow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.surface },
  cname: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 19, color: colors.ink, marginBottom: 3 },
  empty: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: radius.option,
  },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  rel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
