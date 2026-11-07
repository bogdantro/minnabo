import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import { MAP_CREDIT, MAP_PROVIDER } from '@/config/mapStyle';
import type { Listing } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { fitMap, MAX_ZOOM, mapClusters, mergeNearby, MIN_ZOOM, project, TILE, tileUrl, type MapCluster } from '@/domain/mapClusters';
import { safePush } from '@/lib/nav';
import { colors, radius, shadow, text } from '@/theme/theme';
import { listingPrice } from '@/components/OppdragCard';
import { CategoryArt, Icon, IconButton, Pill } from '@/components/ui';
import { Image } from '@/components/ui/Image';

/** 44 pt touch target, the circle grows with the number of posts. */
const MIN_SIZE = 44;
const MAX_SIZE = 76;
const HALO = 26;
const LABEL_W = 120;
const MAX_LABELS = 8;
const CARD_W = 268;
/** Fetch the next tiles after a move this far, not on every frame. */
const REFILL_PX = 96;

const circleSize = (n: number) => Math.min(MAX_SIZE, MIN_SIZE + Math.sqrt(n - 1) * 11);

/**
 * The results on a real map of Norway, filling the screen. Still circles only, never pins (rule 6):
 * a place's circle is spread out around the kommune's centre, and you can't zoom closer than a town.
 */
export function ListingsMap({ listings, onClose }: { listings: Listing[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const clusters = useMemo(() => mapClusters(listings), [listings]);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<MapCluster | null>(null);

  // the phone's back button leaves the map, not the whole search
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const shown = selected?.listings ?? listings;

  return (
    <View
      testID="listings-map"
      style={styles.root}
      onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessibilityLabel={nb.sok.mapA11y(clusters.length)}
    >
      {box.width > 0 && clusters.length ? (
        <Canvas key={`${box.width}x${box.height}`} clusters={clusters} width={box.width} height={box.height} selectedId={selected?.id ?? null} onSelect={setSelected} topInset={insets.top} />
      ) : null}

      <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel={nb.sok.mapBackA11y} onPress={onClose} style={[styles.back, shadow.medium]}>
          <Icon name="list" size={18} color={colors.ink} />
          <Text style={styles.backText}>{nb.sok.mapBack}</Text>
        </Pressable>
        <View style={[styles.count, shadow.medium]}>
          <Text style={styles.countText} numberOfLines={1}>
            {selected ? nb.sok.mapAreaTitle(selected.place, selected.listings.length) : nb.sok.mapAll(listings.length)}
          </Text>
        </View>
      </View>

      <View style={[styles.rail, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <View style={styles.noteRow} pointerEvents="none">
          <View style={styles.note}>
            <Icon name="info" size={13} color={colors.ink2} />
            <Text style={styles.noteText} numberOfLines={2}>
              {nb.sok.mapNote}
            </Text>
          </View>
          <Text style={styles.credit}>{MAP_CREDIT[MAP_PROVIDER]}</Text>
        </View>
        {!clusters.length ? <Text style={[text.meta, styles.none]}>{nb.sok.mapNoPlace}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={CARD_W + 10} contentContainerStyle={styles.cards}>
          {selected ? (
            <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={[styles.allCard, shadow.card]}>
              <Icon name="x" size={18} color={colors.ink} />
              <Text style={styles.allText}>{nb.sok.mapShowAll}</Text>
            </Pressable>
          ) : null}
          {shown.slice(0, 30).map((l) => (
            <MiniCard key={l.id} listing={l} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function MiniCard({ listing: l }: { listing: Listing }) {
  const p = listingPrice(l);
  const offer = l.type === 'SERVICE_OFFER';
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={l.title} onPress={() => safePush(`/oppdrag/${l.id}`)} style={({ pressed }) => [styles.card, shadow.medium, pressed && styles.pressed]}>
      <CategoryArt category={categoryArtId(l.category.slug)} uri={l.images[0]?.url} width={76} height={92} radius={14} iconSize={28} />
      <View style={styles.cardBody}>
        <Pill label={offer ? nb.sok.kinds.SERVICE_OFFER : nb.sok.kinds.TASK_REQUEST} tone={offer ? 'offer' : 'need'} dot size="sm" />
        <Text style={styles.cardTitle} numberOfLines={2}>
          {l.title}
        </Text>
        <Text style={text.meta} numberOfLines={1}>
          {[l.location.place || l.location.municipality, p.value].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

function Canvas({
  clusters,
  width,
  height,
  selectedId,
  onSelect,
  topInset,
}: {
  clusters: MapCluster[];
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (c: MapCluster | null) => void;
  topInset: number;
}) {
  // the card rail covers the bottom, so the picture is centred on what can be seen
  const usable = height - 210;
  const [fit] = useState(() => fitMap(clusters, width, usable));
  const [zoom, setZoom] = useState(fit.zoom);
  const [centre, setCentre] = useState({ x: fit.x, y: fit.y });
  // Tiles sit at fixed spots from this origin; only the layer moves. Then panning never re-lays them out.
  const [origin, setOrigin] = useState({ x: Math.floor(fit.x), y: Math.floor(fit.y) });
  const mx = useSharedValue(fit.x);
  const my = useSharedValue(fit.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);
  const lastX = useSharedValue(fit.x);
  const lastY = useSharedValue(fit.y);

  const circles = useMemo(() => mergeNearby(clusters, zoom, MIN_SIZE + 12), [clusters, zoom]);
  const offsetY = (usable - height) / 2;

  const moveTo = (nextZoom: number, x: number, y: number) => {
    scale.set(1);
    mx.set(x);
    my.set(y);
    lastX.set(x);
    lastY.set(y);
    setZoom(nextZoom);
    setCentre({ x, y });
    setOrigin({ x: Math.floor(x), y: Math.floor(y) });
  };
  const zoomBy = (delta: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
    const f = 2 ** (next - zoom);
    moveTo(next, mx.get() * f, my.get() * f);
  };
  const settle = (x: number, y: number) => setCentre({ x, y });

  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      startX.set(mx.get());
      startY.set(my.get());
    })
    .onUpdate((e) => {
      const x = startX.get() - e.translationX;
      const y = startY.get() - e.translationY;
      mx.set(x);
      my.set(y);
      if (Math.abs(x - lastX.get()) > REFILL_PX || Math.abs(y - lastY.get()) > REFILL_PX) {
        lastX.set(x);
        lastY.set(y);
        runOnJS(settle)(x, y);
      }
    })
    .onEnd(() => runOnJS(settle)(mx.get(), my.get()));
  const pinch = Gesture.Pinch()
    .onUpdate((e) => scale.set(Math.min(4, Math.max(0.25, e.scale))))
    .onEnd(() => runOnJS(zoomBy)(Math.round(Math.log2(scale.get()))));
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => runOnJS(zoomBy)(1));
  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);

  const layer = useAnimatedStyle(() => ({
    transform: [
      { translateX: width / 2 },
      { translateY: height / 2 + offsetY },
      { scale: scale.get() },
      { translateX: origin.x - mx.get() },
      { translateY: origin.y - my.get() },
    ],
  }));

  const tiles = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    const max = 2 ** zoom;
    const x0 = Math.floor((centre.x - width / 2) / TILE) - 1;
    const x1 = Math.floor((centre.x + width / 2) / TILE) + 1;
    const y0 = Math.max(0, Math.floor((centre.y - height / 2 - offsetY) / TILE) - 1);
    const y1 = Math.min(max - 1, Math.floor((centre.y + height / 2 - offsetY) / TILE) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < max) out.push({ x, y });
    return out;
  }, [zoom, centre, width, height, offsetY]);

  return (
    <>
      <GestureDetector gesture={gesture}>
        <View style={styles.canvas} collapsable={false}>
          <Animated.View style={[styles.layer, layer]} pointerEvents="none">
            {tiles.map((t) => (
              <Image
                key={`${zoom}/${t.x}/${t.y}`}
                source={{ uri: tileUrl(zoom, t.x, t.y) }}
                style={[styles.tile, { left: t.x * TILE - origin.x, top: t.y * TILE - origin.y }]}
              />
            ))}
          </Animated.View>
          {circles.map((c, i) => (
            <Circle
              key={c.id}
              cluster={c}
              zoom={zoom}
              labelled={i < MAX_LABELS}
              on={c.id === selectedId}
              mx={mx}
              my={my}
              scale={scale}
              cx={width / 2}
              cy={height / 2 + offsetY}
              onPress={() => onSelect(c.id === selectedId ? null : c)}
            />
          ))}
        </View>
      </GestureDetector>
      <View style={[styles.zoom, { top: topInset + 66 }]}>
        <IconButton icon="plus" iconSize={20} accessibilityLabel={nb.sok.mapZoomIn} disabled={zoom >= MAX_ZOOM} onPress={() => zoomBy(1)} style={shadow.medium} />
        <IconButton icon="minus" iconSize={20} accessibilityLabel={nb.sok.mapZoomOut} disabled={zoom <= MIN_ZOOM} onPress={() => zoomBy(-1)} style={shadow.medium} />
        <IconButton icon="locate" iconSize={18} accessibilityLabel={nb.sok.mapReset} onPress={() => moveTo(fit.zoom, fit.x, fit.y)} style={shadow.medium} />
      </View>
    </>
  );
}

function Circle({
  cluster: c,
  zoom,
  labelled,
  on,
  mx,
  my,
  scale,
  cx,
  cy,
  onPress,
}: {
  cluster: MapCluster;
  zoom: number;
  labelled: boolean;
  on: boolean;
  mx: SharedValue<number>;
  my: SharedValue<number>;
  scale: SharedValue<number>;
  cx: number;
  cy: number;
  onPress: () => void;
}) {
  const n = c.listings.length;
  const size = circleSize(n);
  const outer = size + HALO;
  const at = project(c.lat, c.lon, zoom);
  const follow = useAnimatedStyle(() => ({
    transform: [
      { translateX: cx + (at.x - mx.get()) * scale.get() - outer / 2 },
      { translateY: cy + (at.y - my.get()) * scale.get() - outer / 2 },
    ],
  }));
  return (
    <Animated.View style={[styles.spot, { width: outer, height: outer }, follow]}>
      <View style={[styles.halo, { width: outer, height: outer, borderRadius: outer / 2 }, on && styles.haloOn]} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={nb.sok.mapArea(c.place, n)}
        onPress={onPress}
        style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }, on && styles.dotOn, shadow.medium]}
      >
        <Text style={[text.num, styles.dotText, on && styles.dotTextOn]}>{n}</Text>
      </Pressable>
      {labelled ? (
        <View style={styles.label} pointerEvents="none">
          <Text numberOfLines={1} style={styles.labelText}>
            {c.place}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.track, zIndex: 20, overflow: 'hidden' },
  canvas: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  tile: { position: 'absolute', width: TILE + 0.5, height: TILE + 0.5 },
  spot: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: colors.ink, opacity: 0.16 },
  haloOn: { opacity: 0.3 },
  dot: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.white },
  dotOn: { backgroundColor: colors.ink },
  dotText: { fontSize: 16, color: colors.ink },
  dotTextOn: { color: colors.lime },
  label: { position: 'absolute', top: '100%', width: LABEL_W, marginTop: -8, alignItems: 'center' },
  labelText: {
    maxWidth: LABEL_W,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    overflow: 'hidden',
    fontFamily: text.label.fontFamily,
    fontSize: 12,
    color: colors.ink,
  },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  backText: { fontFamily: text.label.fontFamily, fontSize: 14.5, color: colors.ink },
  count: { flexShrink: 1, height: 46, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.ink },
  countText: { fontFamily: text.label.fontFamily, fontSize: 14, color: colors.white },
  zoom: { position: 'absolute', right: 12, gap: 8 },
  rail: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 8 },
  // the note and the map credit: the credit drops to its own line when it is long (Stadia, MapTiler)
  noteRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, paddingHorizontal: 12 },
  note: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  noteText: { ...text.small, flexShrink: 1, color: colors.ink2 },
  credit: { ...text.small, marginLeft: 'auto', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.white, color: colors.ink2 },
  none: { paddingHorizontal: 16 },
  cards: { gap: 10, paddingHorizontal: 12 },
  card: { width: CARD_W, flexDirection: 'row', gap: 12, padding: 8, borderRadius: radius.card, backgroundColor: colors.white },
  pressed: { opacity: 0.88 },
  cardBody: { flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' },
  cardTitle: { ...text.cardTitle, fontSize: 15, lineHeight: 19 },
  allCard: { width: 84, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.card, backgroundColor: colors.white },
  allText: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.ink },
});
