import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { townLabel, townOf } from '@/lib/places';
import nb from '@/i18n/nb';
import { detectKommune, locationErrorText } from '@/lib/geo';
import type { Reach } from '@/lib/locationScope';
import { haptics } from '@/lib/haptics';
import { KommuneWaitlist } from '@/components/KommuneWaitlist';
import { KOMMUNE_NEIGHBOURS, LAUNCH_KOMMUNER, expandKommuner, isLaunchKommune, kommuneGroup, kommuneGroupNames } from '@/data/kommuner';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Button, FadeUp, Icon, ScaleIn, Sheet, Spinner } from './ui';

const REACHES: Reach[] = [0, 1, 2];
/** How many kommune names the «Du ser oppdrag fra» line spells out before «+ N til». */
const NAMES_SHOWN = 4;

/** The reach as rings: one, two or three, the outer ones dashed until they are part of it. */
function ReachRings({ reach, on }: { reach: Reach; on: boolean }) {
  return (
    <View style={styles.rings} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[2, 1, 0].map((r) => {
        const size = 18 + r * 12;
        const inside = r <= reach;
        return (
          <View
            key={r}
            style={[
              styles.ring,
              { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2 },
              inside ? (on ? styles.ringOnSel : styles.ringOn) : styles.ringOff,
            ]}
          />
        );
      })}
      <View style={[styles.ringDot, on && styles.ringDotSel]} />
    </View>
  );
}

export type LocationSheetProps = {
  visible: boolean;
  onClose: () => void;
  kommune?: string;
  reach: Reach;
  /** Apply the draft (profile kommune + reach). */
  /** `place`: the town «Bruk posisjonen min» found, when that kommune is the one chosen */
  onApply: (kommune: string, reach: Reach, place?: string) => void;
};

/**
 * "Hvor vil du se oppdrag?" (redesigned 2026-11-14): the position as a soft card that turns into «Fant deg»,
 * the kommuner as a two-column grid where the ones that count as one area are marked «Med», the reach as three
 * clear choices with rings, a line saying exactly which kommuner that covers, and «Vis oppdrag» pinned at the bottom.
 * Nothing changes until «Vis oppdrag».
 */
export function LocationSheet({ visible, onClose, kommune, reach, onApply }: LocationSheetProps) {
  const [foundTown, setFoundTown] = useState<string | undefined>(undefined);
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
  // Only the launch kommuner, the current one first, then its neighbours.
  const near = base ? [base, ...(KOMMUNE_NEIGHBOURS[base] ?? [])].filter((k) => isLaunchKommune(k)) : [];
  const options = [...new Set([...near, ...LAUNCH_KOMMUNER])];
  // a kommune chosen before the list was narrowed stays selectable
  if (draftK && !options.includes(draftK)) options.unshift(draftK);
  // the kommuner that come along with the chosen one, even on «Bare min kommune»
  const along = draftK ? kommuneGroup(draftK).slice(1) : [];

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    setErr(null);
    const res = await detectKommune();
    setLocating(false);
    if ('municipality' in res) {
      haptics.success();
      setFound(res.municipality);
      setFoundTown(townOf(res.place, res.municipality));
      setDraftK(res.municipality);
    } else {
      setErr(locationErrorText(res.error));
    }
  };

  const who = draftK || base || '';
  const covered = who ? expandKommuner(who, draftR) : [];
  const coverLine =
    draftR === 2
      ? nb.oppdrag.coverAll
      : covered.length <= NAMES_SHOWN
        ? covered.join(', ')
        : nb.oppdrag.coverMore(covered.slice(0, NAMES_SHOWN).join(', '), covered.length - NAMES_SHOWN);

  const footer = (
    <Button
      label={nb.oppdrag.apply}
      size="lg"
      iconRight="arrow"
      disabled={!draftK}
      onPress={() => onApply(draftK, draftR, draftK === found ? foundTown : undefined)}
    />
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={nb.oppdrag.sheetTitle} subtitle={nb.oppdrag.sheetSub} titleSize="h2" scroll heightRatio={0.92} footer={footer}>
      {/* the position: one soft card that becomes the answer */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={found ? nb.oppdrag.found(townLabel(foundTown, found)) : nb.oppdrag.useLocation}
        accessibilityState={{ busy: locating }}
        onPress={locate}
        style={({ pressed }) => [styles.gps, found && styles.gpsFound, pressed && styles.pressed]}
      >
        <View style={[styles.gpsIc, found && styles.gpsIcFound]}>
          {locating ? (
            <Spinner size={18} color={colors.cyanDeep} />
          ) : found ? (
            <ScaleIn>
              <Icon name="check" size={18} color={colors.white} />
            </ScaleIn>
          ) : (
            <Icon name="locate" size={19} color={colors.cyanDeep} />
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.gpsTitle} numberOfLines={1}>
            {locating ? nb.oppdrag.locating : found ? nb.oppdrag.found(townLabel(foundTown, found)) : nb.oppdrag.useLocation}
          </Text>
          <Text style={styles.gpsSub}>{found ? nb.oppdrag.foundSub : nb.oppdrag.useLocationSub}</Text>
        </View>
        {!locating && !found ? <Icon name="right" size={18} color={colors.cyanDeep} /> : null}
      </Pressable>
      {err ? <Text style={[text.error, styles.err]}>{err}</Text> : null}

      {/* the kommuner, two by two */}
      <View style={styles.head}>
        <Text style={styles.headTitle}>{nb.oppdrag.kommuneLabel}</Text>
        <View style={styles.privacy}>
          <Icon name="shield" size={12} color={colors.mute} />
          <Text style={styles.privacyText}>{nb.oppdrag.kommuneHint}</Text>
        </View>
      </View>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={nb.oppdrag.kommuneLabel}>
        {options.map((k) => {
          const on = draftK === k;
          const comes = along.includes(k);
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={k}
              accessibilityHint={comes ? nb.oppdrag.comesAlongA11y(draftK) : undefined}
              onPress={() => {
                haptics.select();
                setDraftK(k);
              }}
              style={({ pressed }) => [styles.tile, comes && styles.tileAlong, on && styles.tileOn, pressed && styles.pressed]}
            >
              <Text style={[styles.tileText, on && styles.tileTextOn]} numberOfLines={1}>
                {k}
              </Text>
              {on ? (
                <View style={styles.tick}>
                  <Icon name="check" size={12} color={colors.ink} />
                </View>
              ) : comes ? (
                <View style={styles.alongTag}>
                  <Text style={styles.alongText}>{nb.oppdrag.comesAlong}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {along.length ? (
        <FadeUp key={draftK}>
          <Text style={styles.alongNote}>{nb.oppdrag.groupNote(kommuneGroupNames(draftK))}</Text>
        </FadeUp>
      ) : null}
      <View style={styles.waitlist}>
        <KommuneWaitlist />
      </View>

      {/* how far: three choices with rings */}
      <View style={styles.head}>
        <Text style={styles.headTitle}>{nb.oppdrag.reachLabel}</Text>
      </View>
      <View style={styles.reaches} accessibilityRole="radiogroup" accessibilityLabel={nb.oppdrag.reachLabel}>
        {REACHES.map((r) => {
          const on = draftR === r;
          const x = nb.oppdrag.reach[r];
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={x.short}
              accessibilityHint={x.desc(r === 0 && who ? kommuneGroupNames(who) : who || nb.oppdrag.yourKommune)}
              onPress={() => {
                haptics.select();
                setDraftR(r);
              }}
              style={({ pressed }) => [styles.reach, on && styles.reachOn, pressed && styles.pressed]}
            >
              <ReachRings reach={r} on={on} />
              <View style={styles.flex}>
                <Text style={styles.reachName}>{x.name}</Text>
                <Text style={styles.reachDesc} numberOfLines={2}>
                  {x.desc(r === 0 && who ? kommuneGroupNames(who) : who || nb.oppdrag.yourKommune)}
                </Text>
              </View>
              <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
            </Pressable>
          );
        })}
      </View>

      {who ? (
        <View style={styles.cover} accessible accessibilityLabel={`${nb.oppdrag.coverLabel} ${coverLine}`}>
          <Icon name="eye" size={15} color={colors.limeDeep} />
          <Text style={styles.coverText}>
            <Text style={styles.coverLabel}>{nb.oppdrag.coverLabel} </Text>
            {coverLine}
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },
  err: { marginTop: 10 },

  gps: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.card, backgroundColor: colors.cyanTint },
  gpsFound: { backgroundColor: colors.okTint },
  gpsIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  gpsIcFound: { backgroundColor: colors.ok },
  gpsTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  gpsSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.ink2 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 24, marginBottom: 10 },
  headTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  privacyText: { fontFamily: fonts.body, fontSize: 12, color: colors.mute },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '48.5%',
    flexGrow: 1,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tileAlong: { backgroundColor: colors.limeTint, borderColor: colors.limeTint },
  tileOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tileText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.ink },
  tileTextOn: { color: colors.white, fontFamily: fonts.bodyBold },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  alongTag: { height: 22, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.white, justifyContent: 'center' },
  alongText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.limeDeep },
  alongNote: { marginTop: 8, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.mute },
  waitlist: { marginTop: 12 },

  reaches: { gap: 8 },
  reach: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  reachOn: { borderColor: colors.ink, backgroundColor: colors.limeTint },
  reachName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  reachDesc: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.ink2 },
  rings: { width: 46, height: 46 },
  ring: { position: 'absolute', left: '50%', top: '50%', borderWidth: 1.5 },
  // not chosen: the rings in grey, so only the chosen reach looks lit
  ringOn: { borderColor: colors.faint, backgroundColor: 'transparent' },
  ringOnSel: { borderColor: colors.limeDeep, backgroundColor: colors.reachRingOn },
  ringOff: { borderColor: colors.dashed, borderStyle: 'dashed', backgroundColor: 'transparent' },
  ringDot: { position: 'absolute', left: 19, top: 19, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink2 },
  ringDotSel: { backgroundColor: colors.ink },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },

  cover: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, marginBottom: 6, padding: 12, borderRadius: 16, backgroundColor: colors.surface2 },
  coverText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink2 },
  coverLabel: { fontFamily: fonts.bodyBold, color: colors.ink },
});
