import { useEffect, useRef, useState } from 'react';
import { Image as RNImage, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import nb from '@/i18n/nb';
import { uploadCaptured } from '@/lib/uploads';
import { captureViewAsFile } from '@/lib/share';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, radius, text } from '@/theme/theme';
import { Button, Chip, Icon, IconButton, Spinner } from '@/components/ui';

/**
 * The cover for a spot is the photo shrunk to this many pixels across. Everything under it is gone
 * for good once saved: this is a mosaic, not a filter that could be undone.
 */
const MOSAIC_WIDTH = 28;
const SIZES = { S: 44, M: 72, L: 112 } as const;
type Size = keyof typeof SIZES;
type Spot = { id: number; x: number; y: number; size: number };

/** The blur tool only exists where a view can be captured to a file. */
export const canBlurPhotos = Platform.OS !== 'web';

/**
 * Tap to cover faces, number plates and house numbers. The covered photo is saved as a new file,
 * and the old one is replaced in the form, so the sharp original never goes out with the oppdrag.
 * Render with `key={uri}`: each photo starts clean.
 */
export function PhotoBlurEditor({
  uri,
  folder,
  onClose,
  onSaved,
}: {
  uri: string | null;
  folder: string;
  onClose: () => void;
  onSaved: (publicUrl: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const frame = useRef<View>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState<number | null>(null);
  const [mosaic, setMosaic] = useState<string | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [size, setSize] = useState<Size>('M');
  const [saving, setSaving] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    if (!uri) return;
    RNImage.getSize(uri, (w, h) => setRatio(w / h), () => setRatio(4 / 3));
    let live = true;
    ImageManipulator.manipulateAsync(uri, [{ resize: { width: MOSAIC_WIDTH } }], { format: ImageManipulator.SaveFormat.PNG })
      .then((r) => live && setMosaic(r.uri))
      .catch(() => {
        toast.error(nb.blur.failed);
        onClose();
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per photo
  }, [uri]);

  // the photo as big as it can be inside the space above the tools
  const fit = (() => {
    if (!ratio || !area.w || !area.h) return null;
    const w = Math.min(area.w, area.h * ratio);
    return { width: w, height: w / ratio };
  })();

  const save = async () => {
    if (!uri || !frame.current) return;
    setSaving(true);
    try {
      const file = await captureViewAsFile(frame.current, 'jpg');
      const { publicUrl } = await uploadCaptured('listing-images', folder, file);
      haptics.success();
      onSaved(publicUrl);
    } catch {
      toast.error(nb.blur.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!uri} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.wrap, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.top}>
          <IconButton icon="x" accessibilityLabel={nb.blur.cancel} onPress={onClose} />
          <Text style={styles.title} accessibilityRole="header">
            {nb.blur.title}
          </Text>
          <View style={styles.side} />
        </View>
        <View style={styles.stage} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {fit && uri && mosaic ? (
            <View ref={frame} collapsable={false} style={[fit, styles.frame]}>
              <RNImage source={{ uri }} style={fit} accessibilityIgnoresInvertColors />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={nb.blur.addSpot}
                style={StyleSheet.absoluteFill}
                onPress={(e) => {
                  const { locationX: x, locationY: y } = e.nativeEvent;
                  haptics.light();
                  setSpots((s) => [...s, { id: nextId.current++, x, y, size: SIZES[size] }]);
                }}
              />
              {spots.map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={nb.blur.removeSpot}
                  onPress={() => setSpots((all) => all.filter((x) => x.id !== s.id))}
                  style={[styles.spot, { width: s.size, height: s.size, borderRadius: s.size / 2, left: s.x - s.size / 2, top: s.y - s.size / 2 }]}
                >
                  {/* the mosaic lined up with the photo underneath, seen through a round window */}
                  <RNImage
                    source={{ uri: mosaic }}
                    style={{ position: 'absolute', width: fit.width, height: fit.height, left: s.size / 2 - s.x, top: s.size / 2 - s.y }}
                    accessibilityIgnoresInvertColors
                  />
                </Pressable>
              ))}
            </View>
          ) : (
            <Spinner color={colors.lime} />
          )}
        </View>
        <Text style={styles.hint}>{spots.length ? nb.blur.hintUndo : nb.blur.hint}</Text>
        <View style={styles.sizes}>
          {(Object.keys(SIZES) as Size[]).map((k) => (
            <Chip key={k} label={nb.blur.sizes[k]} size="sm" selected={size === k} onPress={() => setSize(k)} />
          ))}
          <Pressable accessibilityRole="button" disabled={!spots.length} onPress={() => setSpots((s) => s.slice(0, -1))} style={[styles.undo, !spots.length && styles.dim]}>
            <Icon name="undo" size={16} color={colors.white} />
            <Text style={styles.undoText}>{nb.blur.undo}</Text>
          </Pressable>
        </View>
        <Button label={nb.blur.save} icon="check" size="lg" loading={saving} disabled={!spots.length} onPress={() => void save()} style={styles.saveBtn} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 44 },
  title: { ...text.h3, color: colors.white },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { overflow: 'hidden', borderRadius: radius.m, backgroundColor: colors.ink },
  spot: { position: 'absolute', overflow: 'hidden', borderWidth: 2, borderColor: colors.white },
  hint: { ...text.meta, color: colors.onInk78, textAlign: 'center' },
  sizes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.onInk14 },
  undoText: { fontFamily: text.label.fontFamily, fontSize: 13.5, color: colors.white },
  dim: { opacity: 0.4 },
  saveBtn: { marginTop: 2 },
});
