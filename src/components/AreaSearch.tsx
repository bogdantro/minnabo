import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useNabolagList } from '@/api/queries';
import { WHOLE_KOMMUNE, profileAreas } from '@/data/kommuner';
import { colors, radius, text } from '@/theme/theme';
import { Icon, Input, Spinner } from './ui';

/** How many areas show before anything is typed – the rest are found by searching. */
const SUGGESTED = 6;

/** 'Søre Ål' and 'sore al' match: lower case, accents and æøå folded. */
const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Område on Rediger profil: a search field over the nabolag MinNabo has set up in the
 * kommune (the `neighbourhoods` table the website manages), plus «Hele kommunen».
 * Falls back to the built-in list when the kommune has no nabolag yet or the list can't load.
 */
export function AreaSearch({
  kommune,
  value,
  onChange,
  error,
}: {
  kommune: string;
  value: string;
  onChange: (area: string) => void;
  /** red ring on the search field (Legg ut: «Skriv inn område eller bydel») */
  error?: boolean;
}) {
  const [q, setQ] = useState('');
  const nabolag = useNabolagList(kommune);

  const all = useMemo(() => {
    const fromDb = (nabolag.data ?? []).map((n) => n.place).filter(Boolean);
    const base = fromDb.length ? fromDb : profileAreas(kommune).filter((a) => a !== WHOLE_KOMMUNE);
    // a place saved earlier stays choosable even if it has left the list
    return [...new Set([WHOLE_KOMMUNE, ...base, ...(value && value !== WHOLE_KOMMUNE ? [value] : [])])];
  }, [nabolag.data, kommune, value]);

  const n = fold(q);
  const matches = n ? all.filter((a) => fold(a).includes(n)) : all.slice(0, SUGGESTED);
  // the chosen one is always visible, also when it isn't among the first suggestions
  const shown = !n && value && !matches.includes(value) ? [...matches, value] : matches;

  return (
    <View style={styles.wrap}>
      <Input
        icon="search"
        value={q}
        onChangeText={setQ}
        placeholder={nb.editProfile.areaSearchPh}
        accessibilityLabel={nb.editProfile.areaSearch}
        autoComplete="off"
        autoCorrect={false}
        returnKeyType="search"
        error={error}
      />
      {nabolag.isLoading ? (
        <View style={styles.loading}>
          <Spinner />
        </View>
      ) : (
        <View style={styles.list} accessibilityRole="radiogroup">
          {shown.map((a) => {
            const on = value === a;
            return (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={a}
                onPress={() => {
                  onChange(a);
                  setQ('');
                }}
                style={[styles.row, on && styles.rowOn]}
              >
                <Icon name={a === WHOLE_KOMMUNE ? 'building' : 'pin'} size={16} color={on ? colors.limeDeep : colors.mute} />
                <Text style={[text.bodySemi, styles.flex, on && { color: colors.limeDeep }]} numberOfLines={1}>
                  {a === WHOLE_KOMMUNE ? nb.editProfile.wholeKommune(kommune) : a}
                </Text>
                {on ? <Icon name="check" size={16} color={colors.limeDeep} /> : null}
              </Pressable>
            );
          })}
          {n && matches.length === 0 ? <Text style={[text.meta, styles.none]}>{nb.editProfile.areaNone(q.trim(), kommune)}</Text> : null}
          {!n && all.length > SUGGESTED ? <Text style={[text.meta, styles.none]}>{nb.editProfile.areaMore(all.length)}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  flex: { flex: 1 },
  loading: { height: 88, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 6 },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  rowOn: { borderColor: colors.limeDeep, backgroundColor: colors.limeTint },
  none: { paddingHorizontal: 4, paddingTop: 2 },
});
