import { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { useSession } from '@/auth/session';
import { useProfile, useUpdateProfile } from '@/api/queries';
import { lookupPostalCode, isPostalCode } from '@/data/postalCodes';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { BottomSheet } from './ui/BottomSheet';
import { TextField } from './ui/TextField';
import { DistanceSlider } from './ui/DistanceSlider';
import { Button } from './ui/Button';

const TOWNS = ['Lillehammer', 'Hamar', 'Gjøvik', 'Elverum', 'Kongsvinger', 'Otta'];

/** Mock device geolocation — a real build would use expo-location. */
function detectLocation(): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve('Lillehammer'), 700));
}

export function LocationBar() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId ?? '');
  const update = useUpdateProfile();

  const currentPlace = profile?.location.place || 'Lillehammer';
  const currentDistance = profile?.maxDistanceKm ?? 15;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(currentPlace);
  const [distance, setDistance] = useState(currentDistance);
  const [locating, setLocating] = useState(false);

  const asPostal = isPostalCode(input);
  const resolved = asPostal ? lookupPostalCode(input) : undefined;
  const place = resolved ?? input;

  const openSheet = () => {
    setInput(currentPlace);
    setDistance(currentDistance);
    setOpen(true);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const detected = await detectLocation();
      setInput(detected);
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    const finalPlace = place.trim() || 'Lillehammer';
    update.mutate({ place: finalPlace, maxDistanceKm: distance });
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.home.changeLocation}
        hitSlop={hitSlop}
        onPress={openSheet}
        style={styles.bar}
      >
        <Icon name="map-pin" size={16} color="cyan" />
        <AppText variant="body" weight="bold">
          {currentPlace}
        </AppText>
        <AppText variant="body" color="navyMuted">
          · {nb.home.locationSuffix} {currentDistance} {nb.common.km}
        </AppText>
        <Icon name="chevron-right" size={16} color="cyan" />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={nb.home.changeLocation} heightRatio={0.72}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheet}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.home.useMyLocation}
            onPress={useMyLocation}
            style={styles.detect}
          >
            <Icon name={locating ? 'loader' : 'navigation'} size={16} color="cyan" />
            <AppText variant="meta" weight="bold" color="cyan">
              {locating ? nb.home.locating : nb.home.useMyLocation}
            </AppText>
          </Pressable>

          <TextField
            label={nb.home.placeOrPostal}
            value={input}
            onChangeText={setInput}
            placeholder="2615"
            keyboardType={asPostal ? 'numeric' : 'default'}
            hint={
              asPostal && resolved
                ? `${nb.home.postalResolved} ${resolved}`
                : asPostal && !resolved
                  ? nb.home.postalUnknown
                  : undefined
            }
          />

          <View style={styles.towns}>
            {TOWNS.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityState={{ selected: place === t }}
                onPress={() => setInput(t)}
                style={[styles.town, place === t && styles.townActive]}
              >
                <AppText variant="meta" weight="bold" color={place === t ? 'white' : 'navy'}>
                  {t}
                </AppText>
              </Pressable>
            ))}
          </View>

          <DistanceSlider label={nb.onboarding.distanceLabel} value={distance} onChange={setDistance} />
        </ScrollView>
        <Button label={nb.search.apply} onPress={save} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
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
  towns: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  town: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  townActive: { backgroundColor: tokens.color.lime, borderColor: tokens.color.lime },
});
