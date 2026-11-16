import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInUp, FadeOut, runOnJS, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import { MAP_CREDIT, MAP_PROVIDER } from '@/config/mapStyle';
import type { Listing, NoticeboardPost } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { fitMap, MAX_ZOOM, mapClusters, mergeNearby, MIN_ZOOM, placeClusters, project, TILE, tileUrl, type MapCluster } from '@/domain/mapClusters';
import { NOTICE_STYLE, noticeType } from '@/components/community/noticeKinds';
import { locationErrorText, myCoords } from '@/lib/geo';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { useOnceTip } from '@/lib/onceTips';
import { CoachTip } from '@/components/ui/CoachTip';
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

/** How far (px) the map must move before «Søk i dette området» is offered. */
const MOVED_PX = 60;
/** The card rail and note at the bottom cover this much of the map. */
const RAIL_H = 200;
/** «Min posisjon» zooms in at least this far (a town), never closer than MAX_ZOOM. */
const MY_POS_ZOOM = 10;
const ME_HALO = 44;

const circleSize = (n: number) => Math.min(MAX_SIZE, MIN_SIZE + Math.sqrt(n - 1) * 11);

/**
 * The results on a real map of Norway, filling the screen. Still circles only, never pins (rule 6):
 * a place's circle is spread out around the kommune's centre, and you can't zoom closer than a town.
 */
/** On the «Gis bort og funnet» map (0101): things given away and lost or found, still open. */
export const MAP_NOTICE_KINDS = ['GIVEAWAY', 'LOST_FOUND'] as const;
type Mode = 'oppdrag' | 'oppslag';

export function ListingsMap({
  listings,
  notices,
  onClose,
}: {
  listings: Listing[];
  /** set → a switch between oppdrag and «Gis bort og funnet»; with no oppdrag the map opens on the oppslag */
  notices?: NoticeboardPost[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const openNotices = useMemo(
    () => (notices ?? []).filter((n) => !n.doneAt && (MAP_NOTICE_KINDS as readonly string[]).includes(n.kind)),
    [notices],
  );
  const [mode, setMode] = useState<Mode>(() => (!listings.length && notices ? 'oppslag' : 'oppdrag'));
  const listingClusters = useMemo(() => mapClusters(listings), [listings]);
  const noticeClusters = useMemo(() => placeClusters(openNotices, (n) => ({ municipality: n.municipality, place: n.place })), [openNotices]);
  const clusters: MapCluster<Listing | NoticeboardPost>[] = mode === 'oppdrag' ? listingClusters : noticeClusters;
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<MapCluster<Listing | NoticeboardPost> | null>(null);
  // «Søk i dette området»: the circles that were in view when it was tapped
  const [area, setArea] = useState<Set<string> | null>(null);
  // the first time: what the circles are (once per phone)
  const mapTip = useOnceTip('mapCircles');

  // the phone's back button leaves the map, not the whole search
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const inArea = useMemo(() => (area ? clusters.filter((c) => area.has(c.id)).flatMap((c) => c.listings) : null), [area, clusters]);
  const everything: (Listing | NoticeboardPost)[] = mode === 'oppdrag' ? listings : openNotices;
  const shown = selected?.listings ?? inArea ?? everything;
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    haptics.select();
    setSelected(null);
    setArea(null);
    setMode(m);
  };
  const showAll = () => {
    setSelected(null);
    setArea(null);
  };
  const searchArea = (ids: Set<string>) => {
    setSelected(null);
    setArea(ids);
  };

  return (
    <View
      testID="listings-map"
      style={styles.root}
      onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessibilityLabel={nb.sok.mapA11y(clusters.length)}
    >
      {box.width > 0 && clusters.length ? (
        <Canvas key={`${mode}-${box.width}x${box.height}`} clusters={clusters} width={box.width} height={box.height} selectedId={selected?.id ?? null} onSelect={setSelected} onSearchArea={searchArea} topInset={insets.top} tipShown={mapTip.show} />
      ) : null}

      {mapTip.show && clusters.length ? (
        <View style={[styles.tipWrap, { top: insets.top + (notices ? 120 : 66) }]} pointerEvents="box-none">
          <CoachTip
            icon="pin"
            title={nb.tips.mapTitle}
            body={nb.tips.mapBody}
            okLabel={nb.tips.ok}
            onDone={mapTip.done}
            pointer="none"
            testID="tip-map"
          />
        </View>
      ) : null}
      <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel={nb.sok.mapBackA11y} onPress={onClose} style={[styles.back, shadow.medium]}>
          <Icon name="list" size={18} color={colors.ink} />
          <Text style={styles.backText}>{nb.sok.mapBack}</Text>
        </Pressable>
        <View style={[styles.count, shadow.medium]}>
          <Text style={styles.countText} numberOfLines={1}>
            {selected ? nb.sok.mapAreaTitle(selected.place, selected.listings.length) : inArea ? nb.sok.mapInArea(inArea.length) : nb.sok.mapAll(everything.length)}
          </Text>
        </View>
      </View>
      {notices ? (
        <View style={[styles.modes, shadow.medium, { top: insets.top + 64 }]} accessibilityRole="tablist" accessibilityLabel={nb.mapModes.label}>
          {(['oppdrag', 'oppslag'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              onPress={() => switchMode(m)}
              style={[styles.mode, mode === m && styles.modeOn]}
            >
              <Icon name={m === 'oppdrag' ? 'clip' : 'gift'} size={15} color={mode === m ? colors.lime : colors.ink2} />
              <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>{m === 'oppdrag' ? nb.mapModes.oppdrag : nb.mapModes.oppslag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

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
        {inArea && !inArea.length && !selected ? (
          <View style={[styles.empty, shadow.card]}>
            <Text style={[text.meta, styles.emptyText]}>{nb.sok.mapNoneInArea}</Text>
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={CARD_W + 10} contentContainerStyle={styles.cards}>
          {selected || area ? (
            <Pressable accessibilityRole="button" onPress={showAll} style={[styles.allCard, shadow.card]}>
              <Icon name="x" size={18} color={colors.ink} />
              <Text style={styles.allText}>{nb.sok.mapShowAll}</Text>
            </Pressable>
          ) : null}
          {shown.slice(0, 30).map((l) => ('kind' in l ? <NoticeCard key={l.id} post={l} /> : <MiniCard key={l.id} listing={l} />))}
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

/** An oppslag on the map's card rail: opens it on Oppslagstavla. */
function NoticeCard({ post }: { post: NoticeboardPost }) {
  const k = NOTICE_STYLE[noticeType(post)];
  const photo = post.imageUrls?.[0] ?? post.imageUrl;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${nb.noticeboard.kindsShort[noticeType(post)]}: ${post.title}`}
      onPress={() => safePush(`/oppslagstavle?oppslag=${post.id}`)}
      style={({ pressed }) => [styles.card, shadow.medium, pressed && styles.pressed]}
    >
      <View style={[styles.noticeArt, { backgroundColor: k.bg }]}>
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Icon name={k.icon} size={28} color={k.fg} />}
      </View>
      <View style={styles.cardBody}>
        <View style={[styles.noticeTag, { backgroundColor: k.bg }]}>
          <Text style={[styles.noticeTagText, { color: k.fg }]}>{nb.noticeboard.kindsShort[noticeType(post)]}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <Text style={text.meta} numberOfLines={1}>
          {post.place || post.municipality}
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
  onSearchArea,
  topInset,
  tipShown,
}: {
  clusters: MapCluster<Listing | NoticeboardPost>[];
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (c: MapCluster<Listing | NoticeboardPost> | null) => void;
  onSearchArea: (clusterIds: Set<string>) => void;
  topInset: number;
  tipShown: boolean;
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
  // the view «Søk i dette området» last searched (at first: the whole picture); the button shows once the map has moved away from it
  const searched = useRef({ zoom: fit.zoom, x: fit.x, y: fit.y });
  const [moved, setMoved] = useState(false);
  // the person's own position (only on this phone), as lat/lon
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const s = searched.current;
    const f = 2 ** (zoom - s.zoom);
    setMoved(zoom !== s.zoom || Math.hypot(centre.x - s.x * f, centre.y - s.y * f) > MOVED_PX);
  }, [zoom, centre]);

  /** The circles whose middle is on screen, between the top buttons and the card rail. */
  const searchArea = () => {
    const x = mx.get();
    const y = my.get();
    const ids = new Set<string>();
    for (const c of clusters) {
      const at = project(c.lat, c.lon, zoom);
      const sx = width / 2 + (at.x - x);
      const sy = height / 2 + offsetY + (at.y - y);
      if (sx >= 0 && sx <= width && sy >= topInset + 56 && sy <= height - RAIL_H) ids.add(c.id);
    }
    searched.current = { zoom, x, y };
    setMoved(false);
    haptics.light();
    onSearchArea(ids);
  };

  const locateMe = async () => {
    if (locating) return;
    setLocating(true);
    const res = await myCoords();
    setLocating(false);
    if ('error' in res) {
      toast.info(locationErrorText(res.error), { icon: 'nav' });
      return;
    }
    setMe({ lat: res.latitude, lon: res.longitude });
    const z = Math.max(zoom, MY_POS_ZOOM);
    const p = project(res.latitude, res.longitude, z);
    haptics.light();
    moveTo(z, p.x, p.y);
  };

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
          {me ? <MyDot lat={me.lat} lon={me.lon} zoom={zoom} mx={mx} my={my} scale={scale} cx={width / 2} cy={height / 2 + offsetY} /> : null}
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
        <IconButton icon="map" iconSize={18} accessibilityLabel={nb.sok.mapReset} onPress={() => moveTo(fit.zoom, fit.x, fit.y)} style={shadow.medium} />
        <IconButton
          icon="nav"
          iconSize={18}
          accessibilityLabel={nb.sok.mapMyPosA11y}
          onPress={() => void locateMe()}
          style={[shadow.medium, me && styles.meOn]}
          testID="map-my-position"
        />
      </View>
      {moved && !tipShown ? (
        <View style={[styles.areaWrap, { top: topInset + 66 }]} pointerEvents="box-none">
          <Animated.View entering={FadeInUp.springify().damping(16)} exiting={FadeOut.duration(140)}>
            <Pressable accessibilityRole="button" onPress={searchArea} style={({ pressed }) => [styles.areaBtn, shadow.medium, pressed && styles.pressed]} testID="map-search-area">
              <Icon name="search" size={16} color={colors.ink} />
              <Text style={styles.areaText}>{nb.sok.mapSearchArea}</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}

/** The person's own spot, like the blue dot in any map app: cyan with a white ring and a soft halo. */
function MyDot({
  lat,
  lon,
  zoom,
  mx,
  my,
  scale,
  cx,
  cy,
}: {
  lat: number;
  lon: number;
  zoom: number;
  mx: SharedValue<number>;
  my: SharedValue<number>;
  scale: SharedValue<number>;
  cx: number;
  cy: number;
}) {
  const at = project(lat, lon, zoom);
  const follow = useAnimatedStyle(() => ({
    transform: [{ translateX: cx + (at.x - mx.get()) * scale.get() - ME_HALO / 2 }, { translateY: cy + (at.y - my.get()) * scale.get() - ME_HALO / 2 }],
  }));
  return (
    <Animated.View style={[styles.spot, styles.me, follow]} pointerEvents="none" accessibilityLabel={nb.sok.mapMyPos} testID="map-me">
      <View style={styles.meHalo} />
      <View style={[styles.meDot, shadow.medium]} />
    </Animated.View>
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
  cluster: MapCluster<unknown>;
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
  tipWrap: { position: 'absolute', left: 12, right: 64, zIndex: 40 },
  // left-aligned under «Liste», clear of the zoom buttons on the right
  modes: { position: 'absolute', left: 12, flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.white, zIndex: 30 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill },
  modeOn: { backgroundColor: colors.ink },
  modeText: { ...text.label, fontSize: 13.5, color: colors.ink2 },
  modeTextOn: { color: colors.white },
  noticeArt: { width: 76, height: 92, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  noticeTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  noticeTagText: { ...text.meta, fontSize: 11.5, fontWeight: '600' },
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
  empty: { marginHorizontal: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.white },
  emptyText: { color: colors.ink2 },
  areaWrap: { position: 'absolute', left: 64, right: 64, alignItems: 'center', zIndex: 30 },
  areaBtn: { height: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 8 },
  areaText: { fontFamily: text.label.fontFamily, fontSize: 14, color: colors.ink },
  meOn: { backgroundColor: colors.cyanTint },
  me: { width: ME_HALO, height: ME_HALO },
  meHalo: { position: 'absolute', width: ME_HALO, height: ME_HALO, borderRadius: ME_HALO / 2, backgroundColor: colors.cyan, opacity: 0.18 },
  meDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.cyan, borderWidth: 3, borderColor: colors.white },
  cards: { gap: 10, paddingHorizontal: 12 },
  card: { width: CARD_W, flexDirection: 'row', gap: 12, padding: 8, borderRadius: radius.card, backgroundColor: colors.white },
  pressed: { opacity: 0.88 },
  cardBody: { flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' },
  cardTitle: { ...text.cardTitle, fontSize: 15, lineHeight: 19 },
  allCard: { width: 84, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.card, backgroundColor: colors.white },
  allText: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.ink },
});
