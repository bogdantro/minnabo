import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import nb from '@/i18n/nb';
import { useOutdoorWarning } from '@/lib/weather';
import { colors, radius, text, type CategoryId } from '@/theme/theme';
import { FadeUp, Icon, type IconName } from './ui';

const ICON: Record<'RAIN' | 'WIND' | 'SNOW', IconName> = { RAIN: 'rain', WIND: 'wind', SNOW: 'snomaking' };

/** «i dag», «i morgen» or the weekday («lørdag»). */
function dayWord(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(d) - start(now)) / 86_400_000);
  if (days === 0) return nb.weather.today;
  if (days === 1) return nb.weather.tomorrow;
  return nb.weather.weekdays[d.getDay()];
}

/**
 * «Det er meldt regn lørdag»: on Jobbdag and the avtale, for outdoor jobs, from MET's real forecast.
 * Nothing at all when the forecast says nothing worth knowing (or can't be reached).
 */
export function WeatherNote({
  category,
  dateISO,
  municipality,
  style,
}: {
  category: CategoryId;
  dateISO?: string;
  municipality?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const warning = useOutdoorWarning(category, dateISO, municipality).data;
  if (!warning || !dateISO) return null;
  return (
    <FadeUp style={[styles.card, style]} testID="weather-note">
      <View style={styles.icon}>
        <Icon name={ICON[warning.kind]} size={20} color={colors.warn} />
      </View>
      <View style={styles.body}>
        <Text style={[text.label, styles.title]}>{nb.weather.title[warning.kind](dayWord(dateISO))}</Text>
        <Text style={text.meta}>{nb.weather.advice[warning.kind]}</Text>
        <Text style={styles.credit}>{nb.weather.credit}</Text>
      </View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.warnTint },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, color: colors.ink },
  credit: { ...text.small, color: colors.mute, marginTop: 4 },
});
