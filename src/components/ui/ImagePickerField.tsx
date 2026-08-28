import { View, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './Text';
import { Icon } from './Icon';

const STOCK = [
  'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?auto=format&fit=crop&w=600&q=60',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=600&q=60',
  'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=600&q=60',
  'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=60',
  'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=60',
];

const MAX = 5;

/**
 * Mock image picker (steg2). "Velg bilder" adds a stock image; real capture /
 * library access arrives in a later phase.
 */
export function ImagePickerField({
  value,
  onChange,
  compact = false,
  uploadSub,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  /** compact = first tile is the dropzone, inline with thumbnails (offer step) */
  compact?: boolean;
  uploadSub?: string;
}) {
  const add = () => {
    if (value.length >= MAX) return;
    const next = STOCK.find((u) => !value.includes(u)) ?? STOCK[value.length % STOCK.length];
    onChange([...value, next]);
  };
  const remove = (url: string) => onChange(value.filter((u) => u !== url));

  const Dropzone = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nb.leggUt.pickPhotos}
      onPress={add}
      style={[styles.dropzone, compact && styles.dropzoneCompact]}
    >
      <Icon name="camera" size={compact ? 24 : 30} color="cyan" />
      {!compact ? (
        <>
          <AppText variant="cardTitle" weight="bold">
            {nb.leggUt.uploadTitle}
          </AppText>
          <AppText variant="meta" color="navyMuted" align="center">
            {uploadSub ?? nb.leggUt.uploadSub}
          </AppText>
          <AppText variant="meta" color="navyMuted">
            {nb.leggUt.uploadLimit}
          </AppText>
          <View style={styles.dzActions}>
            <View style={styles.dzAction}>
              <Icon name="camera" size={15} color="cyan" />
              <AppText variant="meta" weight="bold" color="cyan">
                {nb.leggUt.takePhoto}
              </AppText>
            </View>
            <View style={styles.dzDivider} />
            <View style={styles.dzAction}>
              <Icon name="image" size={15} color="cyan" />
              <AppText variant="meta" weight="bold" color="cyan">
                {nb.leggUt.pickPhotos}
              </AppText>
            </View>
          </View>
        </>
      ) : (
        <>
          <AppText variant="meta" weight="bold">
            {nb.leggUt.pickPhotos}
          </AppText>
          <AppText variant="meta" color="navyMuted" align="center">
            {uploadSub ?? nb.leggUt.offerUploadSub}
          </AppText>
        </>
      )}
    </Pressable>
  );

  const thumbs = value.map((url, i) => (
    <View key={url} style={styles.thumbWrap}>
      <Image source={{ uri: url }} style={styles.thumb} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fjern bilde"
        onPress={() => remove(url)}
        style={styles.removeBtn}
      >
        <Icon name="x" size={13} color="navy" />
      </Pressable>
      {i === 0 ? (
        <View style={styles.mainTag}>
          <AppText variant="meta" weight="bold" color="white" style={styles.mainTagText}>
            {nb.leggUt.mainPhoto}
          </AppText>
        </View>
      ) : null}
    </View>
  ));

  const addTile =
    value.length < MAX ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.leggUt.pickPhotos}
        onPress={add}
        style={styles.addTile}
      >
        <Icon name="plus" size={22} color="cyan" />
      </Pressable>
    ) : null;

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {Dropzone}
          {thumbs}
          {addTile}
        </ScrollView>
        <AppText variant="meta" color="navyMuted">
          {value.length} {nb.leggUt.stepOf} {MAX} {nb.leggUt.photosCount}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {Dropzone}
      {value.length > 0 ? (
        <>
          <View style={styles.dineHead}>
            <AppText variant="cardTitle" weight="bold">
              {nb.leggUt.yourPhotos}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              {value.length} {nb.leggUt.stepOf} {MAX} {nb.leggUt.photosCount}
            </AppText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {thumbs}
            {addTile}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const TILE = 88;

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.md },
  compactWrap: { gap: tokens.space.sm },
  dropzone: {
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    borderStyle: 'dashed',
    borderRadius: tokens.radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.xs,
    padding: tokens.space.lg,
  },
  dropzoneCompact: { width: TILE, height: TILE, padding: tokens.space.sm, borderColor: tokens.color.cyan },
  dzActions: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.lg, marginTop: tokens.space.sm },
  dzAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dzDivider: { width: 1, height: 16, backgroundColor: tokens.color.line },
  dineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { gap: tokens.space.sm, alignItems: 'center' },
  thumbWrap: { width: TILE, height: TILE },
  thumb: { width: TILE, height: TILE, borderRadius: tokens.radius.md },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTag: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    backgroundColor: tokens.color.lime,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  mainTagText: { fontSize: 10 },
  addTile: {
    width: TILE,
    height: TILE,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
