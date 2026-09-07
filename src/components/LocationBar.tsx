import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { useUpdateProfile } from '@/api/queries';
import { useLocationScope } from '@/lib/locationScope';
import { detectKommune } from '@/lib/geo';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { KommunePicker } from './KommunePicker';
import { ReachControl } from './ReachControl';

const REACH_LABEL = [
  nb.location.reachOwn,
  nb.location.reachNeighbours,
  nb.location.reachRegion,
];

export function LocationBar() {
  const { municipality, reach, setReach } = useLocationScope();
  const update = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const useMyLocation = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await detectKommune();
      if ('municipality' in res) {
        update.mutate(
          {
            municipality: res.municipality,
            place: res.place ?? res.municipality,
          },
          { onError: () => setNote(nb.state.error) },
        );
        setNote(`${nb.location.detected} ${res.municipality}`);
      } else {
        setNote(
          res.error === 'denied'
            ? nb.location.permissionDenied
            : nb.location.locationUnavailable,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${nb.home.changeLocation}. ${municipality ?? nb.location.pickKommune}, ${REACH_LABEL[reach]}`}
        hitSlop={hitSlop}
        onPress={() => {
          setNote(null);
          setOpen(true);
        }}
        style={styles.pill}
      >
        <Icon name="map-pin" size={14} color="lime" />
        <AppText variant="meta" weight="bold" color="navyMuted" numberOfLines={1}>
          {municipality ?? nb.location.pickKommune}
        </AppText>
        <Icon name="chevron-down" size={14} color="navyMuted" />
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={nb.home.changeLocation}
        heightRatio={0.8}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheet}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.home.useMyLocation}
            onPress={useMyLocation}
            style={styles.detect}
          >
            <Icon name={busy ? 'loader' : 'navigation'} size={16} color="cyan" />
            <AppText variant="meta" weight="bold" color="cyan">
              {busy ? nb.home.locating : nb.home.useMyLocation}
            </AppText>
          </Pressable>

          {note ? (
            <AppText variant="meta" color="navyMuted">
              {note}
            </AppText>
          ) : null}

          <KommunePicker
            value={municipality ?? ''}
            onChange={(k) => update.mutate({ municipality: k, place: k })}
          />

          <ReachControl value={reach} onChange={setReach} />
        </ScrollView>
        <Button label={nb.search.apply} onPress={() => setOpen(false)} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  sheet: { gap: tokens.space.lg, paddingBottom: tokens.space.lg },
  detect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: tokens.color.cyan,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
});
