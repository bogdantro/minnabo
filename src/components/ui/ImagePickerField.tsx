import { useState } from 'react';
import { View, Image, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useSession } from '@/auth/session';
import { pickAndUpload } from '@/lib/uploads';
import { AppText } from './Text';
import { Icon } from './Icon';

const MAX = 5;

/**
 * Real device image picker for listings. Captures / picks a photo, compresses
 * it and uploads it to Storage; `value` holds the resulting public URLs.
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
  const { userId } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = (source: 'camera' | 'library' = 'library') => async () => {
    if (value.length >= MAX || busy || !userId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await pickAndUpload({ bucket: 'listing-images', folder: userId, source });
      if (res) onChange([...value, res.publicUrl]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = (url: string) => onChange(value.filter((u) => u !== url));

  const Dropzone = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nb.leggUt.pickPhotos}
      onPress={add('library')}
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
        onPress={add('library')}
        style={styles.addTile}
      >
        <Icon name="plus" size={22} color="cyan" />
      </Pressable>
    ) : null;

  const status = (
    <>
      {busy ? (
        <View style={styles.statusRow}>
          <ActivityIndicator color={tokens.color.cyan} size="small" />
          <AppText variant="meta" color="navyMuted">
            {nb.leggUt.uploading}
          </AppText>
        </View>
      ) : null}
      {error ? (
        <AppText variant="meta" color="dangerText">
          {error}
        </AppText>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {Dropzone}
          {thumbs}
          {addTile}
        </ScrollView>
        {status}
        <AppText variant="meta" color="navyMuted">
          {value.length} {nb.leggUt.stepOf} {MAX} {nb.leggUt.photosCount}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {Dropzone}
      {status}
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
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
