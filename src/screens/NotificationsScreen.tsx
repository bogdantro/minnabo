import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { AppNotification, NotificationKind } from "@/domain/types";
import nb from "@/i18n/nb";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/api/queries";
import { daysAgo, formatTime, shortDate } from "@/lib/datetime";
import { safePush } from "@/lib/nav";
import { toast } from "@/lib/toast";
import {
  colors,
  fonts,
  motion,
  radius,
  screenPadding,
  shadow,
  text,
} from "@/theme/theme";
import {
  Button,
  Chip,
  ChipRow,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  ListGroup,
  ListRow,
  RowSkeleton,
  ScaleIn,
  Screen,
  SubHeader,
  Toggle,
  type IconKey,
} from "@/components/ui";

type Cat = "offer" | "msg" | "deal" | "other";
type Filter = "all" | Cat;
type Tone = { bg: string; fg: string };

const TONES = {
  msg: { bg: colors.lavenderTint, fg: colors.lavender },
  need: { bg: colors.limeTint, fg: colors.limeDeep },
  cyan: { bg: colors.cyanTint, fg: colors.cyanDeep },
  ok: { bg: colors.okTint, fg: colors.ok },
  ink: { bg: colors.ink, fg: colors.lime },
  warn: { bg: colors.warnTint, fg: colors.warn },
  star: { bg: colors.starTint, fg: colors.star },
  mute: { bg: colors.neutralPill, fg: colors.muteIcon },
  danger: { bg: colors.dangerTint, fg: colors.danger },
} satisfies Record<string, Tone>;

const KIND: Record<NotificationKind, { cat: Cat; icon: IconKey; tone: Tone }> =
  {
    NEW_MESSAGE: { cat: "msg", icon: "msg", tone: TONES.msg },
    NEW_OFFER: { cat: "offer", icon: "tag", tone: TONES.need },
    OFFER_CHANGED: { cat: "offer", icon: "edit", tone: TONES.cyan },
    OFFER_WITHDRAWN: { cat: "offer", icon: "undo", tone: TONES.mute },
    OFFER_ACCEPTED: { cat: "offer", icon: "check", tone: TONES.ok },
    OFFER_DECLINED: { cat: "offer", icon: "x", tone: TONES.danger },
    AGREED_TIME: { cat: "deal", icon: "cal", tone: TONES.ink },
    COMPLETION_REQUESTED: { cat: "deal", icon: "hourglass", tone: TONES.warn },
    REVIEW_RECEIVED: { cat: "other", icon: "star", tone: TONES.star },
    MODERATION: { cat: "other", icon: "shield", tone: TONES.ok },
  };
const kindOf = (k: NotificationKind) =>
  KIND[k] ?? { cat: "other" as const, icon: "bell" as const, tone: TONES.cyan };

const FILTERS: Filter[] = ["all", "offer", "msg", "deal", "other"];
const GROUPS = ["today", "yday", "older"] as const;
const groupOf = (iso: string) => {
  const d = daysAgo(iso);
  return d <= 0 ? "today" : d === 1 ? "yday" : "older";
};
const timeOf = (iso: string) =>
  daysAgo(iso) <= 1 ? formatTime(iso) : shortDate(iso);

/** Varsler (design/screens/Varsler.dc.html). */
export function NotificationsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, isFetching, refetch } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const [filter, setFilter] = useState<Filter>("all");
  const [only, setOnly] = useState(false);
  // Read locally right away; the server state follows.
  const [readHere, setReadHere] = useState<Set<string>>(() => new Set());

  const items = useMemo(() => data ?? [], [data]);
  const isUnread = (n: AppNotification) => !n.read && !readHere.has(n.id);
  const inCat = (n: AppNotification, f: Filter) =>
    f === "all" || kindOf(n.kind).cat === f;
  const unreadN = items.filter(isUnread).length;
  const visible = items.filter(
    (n) => inCat(n, filter) && (!only || isUnread(n)),
  );

  let idx = 0;
  const groups = GROUPS.map((g) => ({
    g,
    items: visible
      .filter((n) => groupOf(n.createdAt) === g)
      .map((n) => ({ n, i: idx++ })),
  })).filter((g) => g.items.length > 0);

  const onMarkAll = () => {
    if (unreadN === 0) {
      toast.info(nb.notifications.noneUnread, { icon: "info" });
      return;
    }
    setReadHere(new Set(items.map((n) => n.id)));
    markAll.mutate();
    toast.success(nb.notifications.allRead, { icon: "checks" });
  };

  const open = (n: AppNotification) => {
    if (isUnread(n)) {
      setReadHere((s) => new Set(s).add(n.id));
      markOne.mutate(n.id);
    }
    if (n.route) safePush(n.route);
  };

  const filterName =
    filter === "all" ? null : nb.notifications.filters[filter].toLowerCase();

  return (
    <Screen
      scroll
      header={
        <SubHeader
          title={nb.notifications.title}
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          right={
            <IconButton
              icon="checks"
              iconSize={20}
              accessibilityLabel={nb.notifications.markAllRead}
              onPress={onMarkAll}
              style={unreadN === 0 ? styles.dim : undefined}
            />
          }
        />
      }
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={colors.limeDeep}
          />
        ),
      }}
    >
      <FadeUp style={styles.sumbar}>
        <View style={styles.ucount} accessibilityLiveRegion="polite">
          <View style={[styles.bub, unreadN === 0 && styles.bubZero]}>
            <Text style={[styles.bubText, unreadN === 0 && styles.bubTextZero]}>
              {unreadN}
            </Text>
          </View>
          <Text style={styles.ucountText}>
            {nb.notifications.unread(unreadN)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: only }}
          accessibilityLabel={nb.notifications.onlyUnread}
          onPress={() => setOnly((o) => !o)}
          style={styles.onlybtn}
        >
          <Text style={styles.onlyText}>{nb.notifications.onlyUnread}</Text>
          <View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
          >
            <Toggle
              size="sm"
              value={only}
              onValueChange={setOnly}
              accessibilityLabel={nb.notifications.onlyUnread}
            />
          </View>
        </Pressable>
      </FadeUp>

      <FadeUp delay={100} style={styles.chips}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel={nb.notifications.filterLabel}
        >
          <ChipRow>
            {FILTERS.map((f) => {
              const on = filter === f;
              const n = items.filter((x) => inCat(x, f)).length;
              const dot =
                f !== "all" && items.some((x) => inCat(x, f) && isUnread(x));
              return (
                <Chip
                  key={f}
                  label={nb.notifications.filters[f]}
                  selected={on}
                  onPress={() => setFilter(f)}
                  accessibilityLabel={`${nb.notifications.filters[f]}, ${n}`}
                  style={styles.fchip}
                  trailing={
                    <View style={styles.trail}>
                      {dot ? <View style={styles.ud} /> : null}
                      <View style={[styles.n, on && styles.nOn]}>
                        <Text style={[styles.nText, on && styles.nTextOn]}>
                          {n}
                        </Text>
                      </View>
                    </View>
                  }
                />
              );
            })}
          </ChipRow>
        </View>
      </FadeUp>

      {isLoading ? (
        <View style={styles.skel}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </View>
      ) : isError ? (
        <View style={styles.errorBox}>
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        </View>
      ) : visible.length === 0 ? (
        <ScaleIn style={styles.emptyPad}>
          <View style={[styles.empty, shadow.card]}>
            <View style={styles.emptyIcon}>
              <Icon name="bell" size={32} color={colors.cyanDeep} />
            </View>
            <Text style={[text.h3, styles.emptyTitle]}>
              {nb.notifications.emptyTitle}
            </Text>
            <Text style={[text.meta, styles.center, styles.emptySub]}>
              {only
                ? nb.notifications.emptyOnly(filterName)
                : nb.notifications.emptyAll}
            </Text>
            {filter !== "all" || only ? (
              <Button
                label={nb.notifications.showAll}
                variant="ghost"
                size="sm"
                block={false}
                onPress={() => {
                  setFilter("all");
                  setOnly(false);
                }}
                style={styles.emptyBtn}
              />
            ) : null}
          </View>
        </ScaleIn>
      ) : (
        groups.map(({ g, items: rows }) => (
          <FadeUp key={g}>
            <View style={styles.grp}>
              <Text style={text.eyebrow}>{nb.notifications.groups[g]}</Text>
              <View style={styles.grpLine} />
            </View>
            <View style={[styles.nlist, shadow.card]}>
              {rows.map(({ n, i }, k) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  unread={isUnread(n)}
                  first={k === 0}
                  index={i}
                  onPress={() => open(n)}
                />
              ))}
            </View>
          </FadeUp>
        ))
      )}

      <View style={styles.prefs}>
        <ListGroup>
          <ListRow
            title={nb.notifications.prefsTitle}
            subtitle={nb.notifications.prefsSub}
            icon="sliders"
            iconBg={colors.warnTint}
            iconColor={colors.warn}
            onPress={() => safePush("/varslinger")}
          />
        </ListGroup>
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

function NotificationRow({
  n,
  unread,
  first,
  index,
  onPress,
}: {
  n: AppNotification;
  unread: boolean;
  first: boolean;
  index: number;
  onPress: () => void;
}) {
  const k = kindOf(n.kind);
  const reduced = useReducedMotion();
  // 1 = unread look. Fades out row by row (70 ms stagger) when marked read.
  const p = useSharedValue(unread ? 1 : 0);
  useEffect(() => {
    if (unread) {
      p.set(1);
      return;
    }
    if (reduced) {
      p.set(0);
      return;
    }
    p.set(withDelay(index * 70, withTiming(0, { duration: 600 })));
  }, [unread, index, reduced, p]);
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      p.value,
      [0, 1],
      [colors.white, colors.unreadBg],
    ),
  }));
  const bar = useAnimatedStyle(() => ({ opacity: p.value }));
  // Dot springs on the way out like the design's `.udot.gone`.
  const dotScale = useSharedValue(unread ? 1 : 0);
  useEffect(() => {
    dotScale.set(
      reduced
        ? unread
          ? 1
          : 0
        : withDelay(
            unread ? 0 : index * 70,
            withSpring(unread ? 1 : 0, motion.spring),
          ),
    );
  }, [unread, index, reduced, dotScale]);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, dotScale.value),
    transform: [{ scale: Math.max(0, dotScale.value) }],
  }));

  const cat = nb.notifications.cats[k.cat];
  const time = timeOf(n.createdAt);
  return (
    <Pressable
      accessibilityRole={n.route ? "link" : "button"}
      accessibilityLabel={`${unread ? nb.notifications.unreadPrefix : ""}${n.title}. ${n.body}. ${time}`}
      onPress={onPress}
    >
      {({ pressed }) => (
        <Animated.View style={[styles.nrow, bg, pressed && styles.nrowPressed]}>
          {!first ? <View style={styles.sep} /> : null}
          <Animated.View style={[styles.bar, bar]} />
          <View style={[styles.nic, { backgroundColor: k.tone.bg }]}>
            <Icon name={k.icon} size={19} color={k.tone.fg} />
          </View>
          <View style={styles.nb}>
            <Text style={styles.nt}>{n.title}</Text>
            {n.body ? <Text style={styles.nd}>{n.body}</Text> : null}
            <View style={styles.nm}>
              <Text style={styles.nmTime}>{time}</Text>
              <View style={styles.ct}>
                <Text style={styles.ctText}>{cat}</Text>
              </View>
            </View>
          </View>
          <Animated.View style={[styles.udot, shadow.unreadDot, dotStyle]} />
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.45 },
  center: { textAlign: "center" },
  sumbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: screenPadding,
    marginTop: 4,
  },
  ucount: { flexDirection: "row", alignItems: "center", gap: 8 },
  bub: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  bubZero: { backgroundColor: colors.okTint },
  bubText: {
    fontFamily: text.h3.fontFamily,
    fontSize: 13,
    color: colors.white,
  },
  bubTextZero: { color: colors.ok },
  ucountText: {
    fontFamily: text.label.fontFamily,
    fontSize: 14,
    color: colors.ink,
  },
  onlybtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  onlyText: {
    fontFamily: text.bodySemi.fontFamily,
    fontSize: 13.5,
    color: colors.ink2,
  },
  chips: { marginTop: 8 },
  fchip: { paddingLeft: 15, paddingRight: 8, gap: 8 },
  trail: { flexDirection: "row", alignItems: "center", gap: 8 },
  ud: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.notifDot,
    marginLeft: -4,
  },
  n: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: colors.line2,
    alignItems: "center",
    justifyContent: "center",
  },
  nOn: { backgroundColor: colors.onDark16 },
  nText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink2 },
  nTextOn: { color: colors.white },
  skel: { marginTop: 22 },
  errorBox: { height: 380 },
  grp: {
    marginTop: 22,
    marginBottom: 10,
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  grpLine: { flex: 1, height: 1, backgroundColor: colors.progressTrack },
  nlist: {
    backgroundColor: colors.white,
    borderRadius: radius.listingCard,
    overflow: "hidden",
    marginHorizontal: 16,
  },
  nrow: {
    flexDirection: "row",
    gap: 13,
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 16,
  },
  nrowPressed: { backgroundColor: colors.surface2 },
  sep: {
    position: "absolute",
    top: 0,
    left: 68,
    right: 0,
    height: 1,
    backgroundColor: colors.line2,
  },
  bar: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.cyan,
  },
  nic: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  nb: { flex: 1, minWidth: 0, gap: 3 },
  nt: {
    fontFamily: text.label.fontFamily,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
  nd: {
    fontFamily: text.body.fontFamily,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.ink2,
  },
  nm: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  nmTime: {
    fontFamily: text.bodySemi.fontFamily,
    fontSize: 12,
    color: colors.faint,
  },
  ct: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: colors.tagBg,
  },
  ctText: {
    fontFamily: text.label.fontFamily,
    fontSize: 11,
    color: colors.mute,
  },
  udot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.cyan,
    marginTop: 6,
  },
  emptyPad: { paddingHorizontal: screenPadding, marginTop: 26 },
  empty: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.limeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: 6, textAlign: "center" },
  emptySub: { maxWidth: 260 },
  emptyBtn: { marginTop: 6 },
  prefs: { marginTop: 22, paddingHorizontal: screenPadding },
  bottom: { height: 60 },
});
