import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { detectKommune } from '@/lib/geo';
import type { Reach } from '@/lib/locationScope';
import { INNLANDET_KOMMUNER, KOMMUNE_NEIGHBOURS } from '@/data/kommuner';
import { colors, motion, text } from '@/theme/theme';
import {
  Button,
  FadeUp,
  Field,
  Icon,
  OptionCard,
  Radio,
  ScaleIn,
  Segmented,
  Sheet,
} from './ui';

/** One reach ring: grows/brightens with a spring when it becomes part of the reach. */
function Ring({ size, on }: { size: number; on: boolean }) {
  const s = useSharedValue(on ? 1 : 0.92);
  useEffect(() => {
    s.set(withSpring(on ? 1 : 0.92, motion.spring));
  }, [on, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, borderRadius: size / 2 },
        on ? styles.ringOn : styles.ringOff,
        anim,
      ]}
    />
  );
}

export type LocationSheetProps = {
  visible: boolean;
  onClose: () => void;
  kommune?: string;
  reach: Reach;
  /** Apply the draft (profile kommune + reach). */
  onApply: (kommune: string, reach: Reach) => void;
};

/**
 * "Hvor vil du se oppdrag?" – GPS, kommune list (own + neighbours) and the
 * reach segmented control with animated rings. Changes apply on "Vis oppdrag".
 */
export function LocationSheet({ visible, onClose, kommune, reach, onApply }: LocationSheetProps) {
  const [draftK, setDraftK] = useState(kommune ?? '');
  const [draftR, setDraftR] = useState<Reach>(reach);
  const [locating, setLocating] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Reset the draft every time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraftK(kommune ?? '');
      setDraftR(reach);
      setFound(null);
      setErr(null);
    }
  }

  const base = found ?? kommune ?? draftK;
  const options = base
    ? [base, ...(KOMMUNE_NEIGHBOURS[base] ?? [])].slice(0, 6)
    : INNLANDET_KOMMUNER.slice(0, 6);
  if (draftK && !options.includes(draftK)) options.unshift(draftK);

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    setErr(null);
    const res = await detectKommune();
    setLocating(false);
    if ('municipality' in res) {
      setFound(res.municipality);
      setDraftK(res.municipality);
    } else {
      setErr(res.error === 'denied' ? nb.location.permissionDenied : nb.location.locationUnavailable);
    }
  };

  const r = nb.oppdrag.reach[draftR];

  return (
    <Sheet visible={visible} onClose={onClose} title={nb.oppdrag.sheetTitle} titleSize="h2" scroll>
      <Button
        label={locating ? nb.oppdrag.locating : nb.oppdrag.useLocation}
        icon={locating ? undefined : 'locate'}
        variant="ink"
        loading={locating}
        onPress={locate}
      />
      {found ? (
        <FadeUp style={styles.found}>
          <ScaleIn style={styles.okCircle}>
            <Icon name="check" size={14} color={colors.white} />
          </ScaleIn>
          <Text style={[text.okChip, { fontSize: 14 }]}>{nb.oppdrag.found(found)}</Text>
        </FadeUp>
      ) : null}
      {err ? <Text style={[text.error, styles.err]}>{err}</Text> : null}

      <Field label={nb.oppdrag.kommuneLabel} hint={nb.oppdrag.kommuneHint} style={styles.mt22}>
        <View style={styles.klist} accessibilityRole="radiogroup">
          {options.map((k) => (
            <OptionCard
              key={k}
              selected={draftK === k}
              onPress={() => setDraftK(k)}
              accessibilityLabel={k}
              style={styles.kopt}
            >
              <Radio selected={draftK === k} />
              <Text style={[text.optionName, styles.flex, { fontSize: 15 }]}>{k}</Text>
            </OptionCard>
          ))}
        </View>
      </Field>

      <Text style={[text.label, styles.reachLabel]}>{nb.oppdrag.reachLabel}</Text>
      <View style={styles.reachRow}>
        <View style={styles.rings} accessibilityElementsHidden>
          <Ring size={92} on={draftR >= 2} />
          <Ring size={66} on={draftR >= 1} />
          <Ring size={40} on />
          <View style={styles.center} />
        </View>
        <View style={styles.reachText}>
          <Text style={[text.h4, { fontFamily: text.h3.fontFamily, fontSize: 17 }]}>{r.name}</Text>
          <Text style={text.meta}>{r.desc(draftK || base || nb.oppdrag.yourKommune)}</Text>
        </View>
      </View>
      <Segmented<`${Reach}`>
        value={`${draftR}`}
        onChange={(v) => setDraftR(Number(v) as Reach)}
        options={nb.oppdrag.reach.map((x, i) => ({ value: `${i}` as `${Reach}`, label: x.short }))}
        accessibilityLabel={nb.oppdrag.reachLabel}
      />
      <Button
        label={nb.oppdrag.apply}
        size="lg"
        disabled={!draftK}
        onPress={() => onApply(draftK, draftR)}
        style={styles.apply}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt22: { marginTop: 22 },
  found: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.okTint,
  },
  okCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
  err: { marginTop: 10 },
  klist: { gap: 8 },
  kopt: { paddingVertical: 12, paddingHorizontal: 14 },
  reachLabel: { marginTop: 24, marginBottom: 12 },
  reachRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  rings: { width: 92, height: 92 },
  ring: { position: 'absolute', left: '50%', top: '50%', borderWidth: 1.5 },
  ringOn: { backgroundColor: colors.reachRingOn, borderColor: colors.limeDot, borderStyle: 'solid' },
  ringOff: { backgroundColor: colors.hairline, borderColor: colors.dashed, borderStyle: 'dashed' },
  center: {
    position: 'absolute',
    left: 40,
    top: 40,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.ink,
    boxShadow: `0 0 0 4px ${colors.white}`,
  },
  reachText: { flex: 1, gap: 4 },
  apply: { marginTop: 22 },
});
