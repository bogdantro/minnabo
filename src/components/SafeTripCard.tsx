import { useState } from 'react';
import { View, Pressable, Linking, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useSafeTrip } from '@/lib/safeTrip';
import { useTrustedContacts } from '@/lib/trustedContacts';
import { formatTime } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { Button } from './ui/Button';

const DURATIONS = [1, 2, 3];

export function SafeTripCard({ proposalId, label }: { proposalId: string; label: string }) {
  const { trip, overdue, start, checkIn } = useSafeTrip();
  const { contacts } = useTrustedContacts();
  const [hours, setHours] = useState(2);

  const mineActive = trip?.proposalId === proposalId;

  const begin = () => {
    if (contacts.length === 0) return;
    const now = new Date();
    start({
      proposalId,
      label,
      startedAt: now.toISOString(),
      dueAt: new Date(now.getTime() + hours * 3600_000).toISOString(),
      contactNames: contacts.map((c) => c.name),
    });
    haptics.success();
    toast.success(nb.safeTrip.started);
  };

  const done = () => {
    checkIn();
    haptics.success();
    toast.success(nb.safeTrip.checkedIn);
  };

  const sos = async () => {
    const ok = await confirm({
      title: nb.safeTrip.sosTitle,
      message: nb.safeTrip.sosBody,
      confirmLabel: nb.safeTrip.sosCall,
      destructive: true,
    });
    if (!ok) return;
    Linking.openURL('tel:112').catch(() => undefined);
  };

  const alertContacts = () => {
    haptics.warning();
    toast.success(nb.safeTrip.contactsAlerted);
  };

  if (mineActive && trip) {
    return (
      <View style={[styles.card, overdue && styles.cardOverdue]}>
        <View style={styles.headRow}>
          <Icon name={overdue ? 'alert-triangle' : 'shield'} size={18} color={overdue ? 'dangerText' : 'lime'} />
          <AppText variant="cardTitle" weight="bold">
            {overdue ? nb.safeTrip.overdue : nb.safeTrip.activeTitle}
          </AppText>
        </View>
        <AppText variant="meta" color="navyMuted">
          {nb.safeTrip.dueLabel}: {formatTime(trip.dueAt)} · {nb.safeTrip.willAlert} {trip.contactNames.join(', ')}
        </AppText>
        {overdue ? (
          <AppText variant="meta" color="dangerText">
            {nb.safeTrip.overdueBody}
          </AppText>
        ) : null}
        <Button label={nb.safeTrip.checkIn} onPress={done} iconRight="check" />
        <View style={styles.sosRow}>
          <Button label={nb.safeTrip.alertContacts} variant="secondary" onPress={alertContacts} style={styles.sosBtn} />
          <Button label={nb.safeTrip.sos} variant="secondary" onPress={sos} iconLeft="phone" style={styles.sosBtn} />
        </View>
      </View>
    );
  }

  if (trip) return null; // a trip for another agreement is already running

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Icon name="shield" size={18} color="lime" />
        <AppText variant="cardTitle" weight="bold">
          {nb.safeTrip.title}
        </AppText>
      </View>
      <AppText variant="meta" color="navyMuted">
        {nb.safeTrip.body}
      </AppText>

      {contacts.length === 0 ? (
        <Button
          label={nb.safeTrip.manageContacts}
          variant="secondary"
          iconRight="chevron-right"
          onPress={() => safePush('/trygge-kontakter')}
        />
      ) : (
        <>
          <AppText variant="meta" weight="bold" color="navyMuted">
            {nb.safeTrip.duration}
          </AppText>
          <View style={styles.chips}>
            {DURATIONS.map((h) => (
              <Pressable
                key={h}
                accessibilityRole="button"
                accessibilityState={{ selected: hours === h }}
                accessibilityLabel={`${h} ${nb.safeTrip.hours}`}
                onPress={() => setHours(h)}
                style={[styles.chip, hours === h && styles.chipActive]}
              >
                <AppText variant="meta" weight="bold" color={hours === h ? 'lime' : 'navy'}>
                  {h} {nb.safeTrip.hours}
                </AppText>
              </Pressable>
            ))}
          </View>
          <Button label={nb.safeTrip.start} onPress={begin} iconRight="shield" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.space.sm,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.lg,
    ...tokens.shadow.card,
  },
  cardOverdue: { borderColor: tokens.color.dangerText },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  chips: { flexDirection: 'row', gap: tokens.space.sm },
  chip: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
  },
  chipActive: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  sosRow: { flexDirection: 'row', gap: tokens.space.sm },
  sosBtn: { flex: 1 },
});
