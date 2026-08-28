import { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { authStore, useAuth } from '@/data/authStore';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { BottomSheet } from './ui/BottomSheet';
import { TextField } from './ui/TextField';
import { DistanceSlider } from './ui/DistanceSlider';
import { Button } from './ui/Button';

const TOWNS = ['Lillehammer', 'Hamar', 'Gjøvik', 'Elverum', 'Kongsvinger', 'Otta'];

export function LocationBar() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(auth.place ?? 'Lillehammer');
  const [distance, setDistance] = useState(auth.maxDistanceKm ?? 15);

  const save = () => {
    authStore.patch({ place: place.trim(), municipality: place.trim(), maxDistanceKm: distance });
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.home.changeLocation}
        hitSlop={hitSlop}
        onPress={() => setOpen(true)}
        style={styles.bar}
      >
        <Icon name="map-pin" size={16} color="cyan" />
        <AppText variant="body" weight="bold">
          {auth.place}
        </AppText>
        <AppText variant="body" color="navyMuted">
          · {nb.home.locationSuffix} {auth.maxDistanceKm} {nb.common.km}
        </AppText>
        <Icon name="chevron-right" size={16} color="cyan" />
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={nb.home.changeLocation}
        heightRatio={0.7}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheet}>
          <TextField label={nb.onboarding.placeLabel} value={place} onChangeText={setPlace} />
          <View style={styles.towns}>
            {TOWNS.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityState={{ selected: place === t }}
                onPress={() => setPlace(t)}
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
