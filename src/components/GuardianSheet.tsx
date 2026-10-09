import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useGuardianActions, useGuardianLinks } from '@/api/queries';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Button, Field, Icon, Input, Note, Sheet, Spinner, TextLink } from '@/components/ui';

const errorText = (e: unknown) => (e instanceof Error && e.message ? e.message : nb.toast.genericError);

/**
 * Foresatt ↔ ungdomskonto. A youth account makes a code and gives it to a
 * parent; the parent types it in here. The parent is then told when the youth
 * gets an avtale (who with and when) – nothing else is shared. The backend
 * decides who is a youth account (0038) and sends the messages (0053).
 */
export function GuardianSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, isLoading } = useGuardianLinks(visible);
  const { createCode, link, unlink } = useGuardianActions();
  const [code, setCode] = useState('');
  const t = nb.guardian;
  const youth = !!data?.youth;

  const remove = (id: string) =>
    unlink.mutate(id, {
      onSuccess: () => toast.info(t.removed, { icon: 'x' }),
      onError: (e) => toast.error(errorText(e)),
    });

  const connect = () => {
    const c = code.replace(/\s/g, '').toUpperCase();
    if (c.length < 6 || link.isPending) return;
    link.mutate(c, {
      onSuccess: (name) => {
        setCode('');
        toast.success(t.linked(name.split(' ')[0] || t.theYouth), { icon: 'check' });
      },
      onError: (e) => toast.error(errorText(e)),
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t.title} titleSize="h2" subtitle={youth ? t.subYouth : t.subAdult} scroll>
      {isLoading || !data ? (
        <View style={styles.loading}>
          <Spinner size={22} color={colors.cyanDeep} />
        </View>
      ) : youth ? (
        <View style={styles.gap14}>
          {data.guardians.map((g) => (
            <Row key={g.id} name={g.name} sub={t.guardianSub} onRemove={() => remove(g.id)} />
          ))}
          {data.code ? (
            <View style={styles.codeBox} accessible accessibilityLabel={t.codeA11y(data.code.code.split('').join(' '))}>
              <Text style={[text.meta, { color: colors.cyanDeep }]}>{t.codeLabel}</Text>
              <Text style={styles.code}>{`${data.code.code.slice(0, 3)} ${data.code.code.slice(3)}`}</Text>
              <Text style={[text.meta, styles.center]}>{t.codeHelp}</Text>
            </View>
          ) : null}
          <Button
            label={data.code ? t.newCode : t.makeCode}
            icon="key"
            variant={data.code ? 'ghost' : 'ink'}
            loading={createCode.isPending}
            onPress={() => createCode.mutate(undefined, { onError: (e) => toast.error(errorText(e)) })}
          />
          <Note icon="shield">{t.noteYouth}</Note>
        </View>
      ) : (
        <View style={styles.gap14}>
          {data.youths.map((y) => (
            <Row key={y.id} name={y.name} sub={y.age ? t.youthSub(y.age) : t.youthSubNoAge} onRemove={() => remove(y.id)} />
          ))}
          <Field label={t.enterCode} help={t.enterCodeHelp}>
            <Input
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 7))}
              placeholder="ABC 234"
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel={t.enterCode}
              style={styles.codeInput}
            />
          </Field>
          <Button
            label={t.connect}
            icon="check"
            variant="cyan"
            disabled={code.replace(/\s/g, '').length < 6}
            loading={link.isPending}
            onPress={connect}
          />
          <Note icon="shield">{t.noteAdult}</Note>
        </View>
      )}
    </Sheet>
  );
}

function Row({ name, sub, onRemove }: { name: string; sub: string; onRemove: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIc}>
        <Icon name="users" size={18} color={colors.cyanDeep} />
      </View>
      <View style={styles.flex}>
        <Text style={text.label}>{name}</Text>
        <Text style={text.meta}>{sub}</Text>
      </View>
      <TextLink label={nb.guardian.remove} onPress={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap14: { gap: 14 },
  center: { textAlign: 'center' },
  loading: { height: 120, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.m, backgroundColor: colors.surface2 },
  rowIc: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  codeBox: { alignItems: 'center', gap: 6, padding: 18, borderRadius: radius.card, backgroundColor: colors.cyanTint },
  code: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: 4, color: colors.ink },
  codeInput: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 2 },
});
