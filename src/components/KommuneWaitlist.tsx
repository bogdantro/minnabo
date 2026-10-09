import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useJoinKommuneWaitlist } from '@/api/queries';
import { INNLANDET_KOMMUNER, isLaunchKommune } from '@/data/kommuner';
import { colors, radius, text } from '@/theme/theme';
import { Button, Chip, FadeUp, Icon, Input, TextLink } from '@/components/ui';

/**
 * `initial`: what the person searched for in the list above; used until they type here.
 *
 * "Si fra når MinNabo kommer til min kommune" – shown under every kommune list.
 * MinNabo only runs in the launch kommuner; this tells us where to go next.
 */
export function KommuneWaitlist({ initial }: { initial?: string }) {
  const join = useJoinKommuneWaitlist();
  const [open, setOpen] = useState(false);
  const [typed, setKommune] = useState<string | null>(null);
  const kommune = typed ?? initial ?? '';
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const name = kommune.trim();
  const needle = name.toLowerCase();
  const suggestions =
    needle.length >= 2
      ? INNLANDET_KOMMUNER.filter((k) => !isLaunchKommune(k) && k.toLowerCase().startsWith(needle) && k.toLowerCase() !== needle).slice(0, 4)
      : [];

  const send = () => {
    if (join.isPending) return;
    if (name.length < 2) return setErr(nb.waitlist.errEmpty);
    if (isLaunchKommune(name)) return setErr(nb.waitlist.errLaunched(name));
    setErr(null);
    join.mutate(name, {
      onSuccess: () => setDone(name),
      onError: () => setErr(nb.toast.genericError),
    });
  };

  if (done) {
    return (
      <FadeUp style={styles.done}>
        <Icon name="check" size={18} color={colors.ok} />
        <Text style={styles.doneText}>{nb.waitlist.done(done)}</Text>
      </FadeUp>
    );
  }
  if (!open) return <TextLink label={nb.waitlist.link} icon="bell" onPress={() => setOpen(true)} />;

  return (
    <FadeUp style={styles.box}>
      <Text style={text.label}>{nb.waitlist.title}</Text>
      <Text style={[text.meta, styles.sub]}>{nb.waitlist.sub}</Text>
      <Input
        value={kommune}
        onChangeText={(v) => {
          setKommune(v.slice(0, 60));
          setErr(null);
        }}
        placeholder={nb.waitlist.placeholder}
        autoCorrect={false}
        error={!!err}
        accessibilityLabel={nb.waitlist.title}
      />
      {suggestions.length ? (
        <View style={styles.chips}>
          {suggestions.map((k) => (
            <Chip key={k} label={k} size="sm" onPress={() => setKommune(k)} />
          ))}
        </View>
      ) : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Button label={nb.waitlist.send} icon="bell" variant="ink" size="sm" loading={join.isPending} onPress={send} />
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10, padding: 14, borderRadius: radius.m, backgroundColor: colors.surface2 },
  sub: { color: colors.ink2, marginTop: -4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  err: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.danger },
  done: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: radius.m, backgroundColor: colors.okTint },
  doneText: { flex: 1, fontFamily: text.label.fontFamily, fontSize: 14, lineHeight: 19.6, color: colors.okText },
});
