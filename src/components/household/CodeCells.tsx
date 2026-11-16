import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import nb from '@/i18n/nb';
import { cleanCode, HOUSEHOLD_CODE_LEN } from '@/domain/household';
import { colors, fonts, radius } from '@/theme/theme';

/** The invitation code as six tiles on ink, to read out or show to the one you live with. */
export function CodeTiles({ code }: { code: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={nb.household.codeA11y(code.split('').join(' '))}>
      {code.split('').map((c, i) => (
        <View key={i} style={styles.tileInk}>
          <Text style={styles.charInk} selectable>
            {c}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Typing a code: six cells over one hidden input, so paste, autofill and the keyboard's delete all just work.
 * The cell where the next letter goes is outlined.
 */
export function CodeInput({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone?: () => void }) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length: HOUSEHOLD_CODE_LEN }, (_, i) => value[i] ?? '');
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityRole="none" importantForAccessibility="no">
      <View style={styles.row} pointerEvents="none">
        {cells.map((c, i) => {
          const current = focused && (i === value.length || (i === HOUSEHOLD_CODE_LEN - 1 && value.length === HOUSEHOLD_CODE_LEN));
          return (
            <View key={i} style={[styles.cell, c ? styles.cellFilled : null, current ? styles.cellCurrent : null]}>
              <Text style={styles.char}>{c}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(v) => {
          const clean = cleanCode(v);
          onChange(clean);
          if (clean.length === HOUSEHOLD_CODE_LEN) onDone?.();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={HOUSEHOLD_CODE_LEN + 4}
        accessibilityLabel={nb.household.codeLabel}
        placeholder={nb.household.codePh}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  tileInk: { flex: 1, maxWidth: 48, height: 58, borderRadius: 14, backgroundColor: colors.onInk08, borderWidth: 1.5, borderColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  charInk: { fontFamily: fonts.display, fontSize: 28, color: colors.lime },
  cell: { flex: 1, maxWidth: 50, height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  cellFilled: { backgroundColor: colors.white, borderColor: colors.ink2 },
  cellCurrent: { borderColor: colors.cyan2, borderWidth: 2, backgroundColor: colors.white },
  char: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  hidden: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.011, color: 'transparent', fontSize: 1, borderRadius: radius.card },
});
