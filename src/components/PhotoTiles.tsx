import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { pickAndUpload, type UploadBucket } from '@/lib/uploads';
import { colors, fonts, radius } from '@/theme/theme';
import { Icon, Spinner } from '@/components/ui';
import { Image } from '@/components/ui/Image';

export type UploadedPhoto = { path: string; url: string };

/**
 * A row of small photos with «Legg til» at the end, for forms (a review's photos, 2026-11-09).
 * Uploads to the person's own folder, which the server checks (0099). Each photo has an × to take it out.
 */
export function PhotoTiles({
  photos,
  max,
  userId,
  onChange,
  bucket = 'listing-images',
  testID,
}: {
  photos: UploadedPhoto[];
  max: number;
  userId: string;
  onChange: (photos: UploadedPhoto[]) => void;
  bucket?: UploadBucket;
  testID?: string;
}) {
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (busy || !userId || photos.length >= max) return;
    setBusy(true);
    try {
      const res = await pickAndUpload({ bucket, folder: userId, source: 'library' });
      if (res) onChange([...photos, { path: res.path, url: res.publicUrl }].slice(0, max));
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.row} testID={testID}>
      {photos.map((p, i) => (
        <View key={p.path} style={styles.tile}>
          <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.photoTiles.remove(i + 1)}
            onPress={() => onChange(photos.filter((x) => x.path !== p.path))}
            hitSlop={8}
            style={styles.x}
          >
            <Icon name="x" size={14} color={colors.white} />
          </Pressable>
        </View>
      ))}
      {photos.length < max ? (
        <Pressable accessibilityRole="button" accessibilityLabel={nb.photoTiles.add} onPress={() => void add()} style={({ pressed }) => [styles.tile, styles.add, pressed && styles.pressed]}>
          {busy ? <Spinner size={20} color={colors.mute} /> : <Icon name="camera" size={20} color={colors.mute} />}
          <Text style={styles.addText}>{photos.length ? nb.photoTiles.more : nb.photoTiles.add}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const SIZE = 84;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: SIZE, height: SIZE, borderRadius: radius.m, overflow: 'hidden', backgroundColor: colors.track },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.mute },
  pressed: { opacity: 0.8 },
  x: { position: 'absolute', top: 5, right: 5, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
});
