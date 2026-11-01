import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { colors, radius, shadow, text } from '@/theme/theme';
import { FadeUp, Icon, Pill, Sheet, type IconKey } from './ui';

export type PostKind = 'need' | 'offer';

const OPTIONS: { kind: PostKind; icon: IconKey; bg: string; fg: string; tone: 'need' | 'offer' }[] = [
  { kind: 'need', icon: 'clip', bg: colors.limeTint, fg: colors.limeDeep, tone: 'need' },
  { kind: 'offer', icon: 'hand', bg: colors.cyanTint, fg: colors.cyanDeep, tone: 'offer' },
];

/** «Hva vil du legge ut?» – the raised Legg ut button: an oppdrag, or what you can help with (0076). */
export function LeggUtChooser({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (k: PostKind) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.offer.chooseTitle} titleSize="h2" subtitle={nb.offer.chooseSub} testID="legg-ut-chooser">
      <View style={styles.wrap}>
        {OPTIONS.map((o, i) => {
          const title = o.kind === 'need' ? nb.offer.needTitle : nb.offer.offerTitle;
          const sub = o.kind === 'need' ? nb.offer.needSub : nb.offer.offerSub;
          return (
            <FadeUp key={o.kind} delay={i * 60}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${sub}`}
                onPress={() => {
                  haptics.select();
                  onPick(o.kind);
                }}
                style={({ pressed }) => [styles.card, shadow.card, pressed && styles.pressed]}
              >
                <View style={[styles.ic, { backgroundColor: o.bg }]}>
                  <Icon name={o.icon} size={26} color={o.fg} />
                </View>
                <View style={styles.body}>
                  <Pill label={o.kind === 'need' ? nb.offer.segNeed : nb.offer.segOffer} tone={o.tone} dot size="sm" />
                  <Text style={[text.label, styles.title]}>{title}</Text>
                  <Text style={text.meta}>{sub}</Text>
                </View>
                <View style={styles.arrow}>
                  <Icon name="arrow" size={18} color={colors.ink} />
                </View>
              </Pressable>
            </FadeUp>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingBottom: 8 },
  card: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  pressed: { transform: [{ scale: 0.985 }] },
  ic: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 17 },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
