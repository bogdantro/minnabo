import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSetHelperStatus } from '@/api/queries';
import nb from '@/i18n/nb';
import { serverMessage } from '@/lib/errors';
import { approximatePlace } from '@/lib/geo';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, radius, text } from '@/theme/theme';
import { Button, Checkbox, Icon, Sheet } from '@/components/ui';

/**
 * «Jeg er framme»: the helper can choose to show the owner roughly where they are – the
 * street and town, never a number (0078). Off by default; the owner sees it only today.
 */
export function ArrivedSheet({
  visible,
  onClose,
  proposalId,
  otherFirst,
}: {
  visible: boolean;
  onClose: () => void;
  proposalId: string;
  otherFirst: string;
}) {
  const status = useSetHelperStatus(proposalId);
  const [share, setShare] = useState(false);
  const [locating, setLocating] = useState(false);

  const send = async () => {
    let place: string | undefined;
    if (share) {
      setLocating(true);
      place = (await approximatePlace()) ?? undefined;
      setLocating(false);
      // the status matters more than the place: send it anyway, and say so
      if (!place) toast.info(nb.rescue.arrivedNoPlace, { icon: 'pin', bottom: 150 });
    }
    status.mutate(
      { status: 'ARRIVED', place },
      {
        onSuccess: () => {
          haptics.success();
          onClose();
          toast.success(nb.rescue.sentStatus(otherFirst), { icon: 'pin', bottom: 150 });
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }),
      },
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={nb.rescue.arrivedTitle} subtitle={nb.rescue.arrivedSub(otherFirst)}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: share }}
        accessibilityLabel={nb.rescue.arrivedShare(otherFirst)}
        onPress={() => {
          haptics.light();
          setShare((v) => !v);
        }}
        style={[styles.opt, share && styles.optOn]}
        testID="arrived-share"
      >
        <View style={styles.ic}>
          <Icon name="pin" size={18} color={colors.cyanDeep} />
        </View>
        <View style={styles.body}>
          <Text style={[text.label, styles.optTitle]}>{nb.rescue.arrivedShare(otherFirst)}</Text>
          <Text style={text.meta}>{nb.rescue.arrivedShareSub}</Text>
        </View>
        <Checkbox checked={share} />
      </Pressable>
      <Button
        label={locating ? nb.rescue.arrivedLocating : nb.rescue.arrived}
        icon="pin"
        size="lg"
        loading={locating || status.isPending}
        onPress={() => void send()}
        style={styles.cta}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  optOn: { borderColor: colors.cyanDeep, backgroundColor: colors.cyanTint },
  ic: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cyanTint },
  body: { flex: 1, minWidth: 0, gap: 2 },
  optTitle: { fontSize: 14.5 },
  cta: { marginTop: 16 },
});
