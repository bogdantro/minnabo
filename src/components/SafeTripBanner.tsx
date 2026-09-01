import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useSafeTrip } from '@/lib/safeTrip';
import { formatTime } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

/**
 * Slim always-visible bar while a "trygg tur" is running, so the person can
 * jump back to check in from anywhere in the app. Turns red once overdue.
 */
export function SafeTripBanner() {
  const insets = useSafeAreaInsets();
  const { trip, overdue } = useSafeTrip();

  if (!trip) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nb.safeTrip.activeTitle}
      onPress={() => safePush(`/avtale/${trip.proposalId}`)}
      style={[
        styles.wrap,
        { paddingTop: insets.top + tokens.space.xs },
        overdue && styles.overdue,
      ]}
    >
      <Icon name={overdue ? 'alert-triangle' : 'shield'} size={14} color="white" />
      <AppText variant="meta" weight="bold" color="white">
        {overdue ? nb.safeTrip.overdue : nb.safeTrip.activeTitle} · {nb.safeTrip.dueLabel} {formatTime(trip.dueAt)}
      </AppText>
      <Icon name="chevron-right" size={14} color="white" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.sm,
    paddingBottom: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    backgroundColor: tokens.color.lime,
  },
  overdue: { backgroundColor: tokens.color.dangerText },
});
