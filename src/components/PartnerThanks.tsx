import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import nb from '@/i18n/nb';
import type { Partner } from '@/domain/types';
import { usePartnerThanks, useThankPartner } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, text } from '@/theme/theme';
import { Button, Icon } from '@/components/ui';

/** "47 naboer har takket" – nothing until somebody has. */
export function ThanksCount({ partnerId, style }: { partnerId: string; style?: StyleProp<ViewStyle> }) {
  const count = usePartnerThanks().data?.[partnerId]?.count ?? 0;
  if (count <= 0) return null;
  return (
    <View style={[styles.row, style]} accessible accessibilityLabel={nb.fellesskap.thanksCount(count)}>
      <Icon name="heart" size={14} color={colors.limeDeep} />
      <Text style={[text.meta, styles.text]}>{nb.fellesskap.thanksCount(count)}</Text>
    </View>
  );
}

/**
 * "Takk for støtten": counted once per person per partner. After thanking it reads
 * "Du har takket" and can't be pressed again.
 */
export function ThanksButton({
  partner,
  variant = 'ghost',
  onThanked,
  style,
}: {
  partner: Pick<Partner, 'id' | 'name'>;
  variant?: 'ghost' | 'ink';
  onThanked?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const mine = !!usePartnerThanks().data?.[partner.id]?.mine;
  const thank = useThankPartner();
  if (mine) {
    return <Button label={nb.fellesskap.thanksDone} icon="check" variant="ghost" disabled onPress={() => undefined} style={style} />;
  }
  return (
    <Button
      label={nb.fellesskap.thanks}
      icon="heart"
      variant={variant}
      loading={thank.isPending}
      onPress={() =>
        thank.mutate(partner.id, {
          onSuccess: () => {
            haptics.success();
            toast.success(nb.fellesskap.thanked(partner.name), { icon: 'heart' });
            onThanked?.();
          },
          onError: () => toast.error(nb.fellesskap.thanksFailed),
        })
      }
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { color: colors.limeDeep, fontFamily: text.label.fontFamily, fontSize: 13 },
});
