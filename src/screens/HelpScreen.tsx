import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { HelpArt } from '@/components/art/Scenes';
import { Button, FadeUp, Icon, Screen, SubHeader, type IconName } from '@/components/ui';

/** One icon and colour per topic, in the order of nb.help.groups. */
const TOPIC_LOOK: { icon: IconName; bg: string; fg: string }[] = [
  { icon: 'sparkle', bg: colors.limeTint, fg: colors.limeDeep },
  { icon: 'clip', bg: colors.cyanTint, fg: colors.cyanDeep },
  { icon: 'shield', bg: colors.okTint, fg: colors.okText },
  { icon: 'user', bg: colors.lavenderTint, fg: colors.lavender },
];

const LINKS: { icon: IconName; label: string; to: string }[] = [
  { icon: 'shield', label: nb.help.linkSafety, to: '/sikkerhet' },
  { icon: 'file', label: nb.help.linkTerms, to: '/vilkar' },
  { icon: 'lock', label: nb.help.linkPrivacy, to: '/personvern' },
];

/**
 * Hjelp: search, the topics as tiles that filter the questions, the answers in tidy cards, and «Kontakt oss»
 * (the thread with MinNabo in Innboks) when nothing fits.
 */
export function HelpScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  // a youth account doesn't post oppdrag: those answers would only confuse
  const all = nb.help.groups.map((g, i) => ({ ...g, look: TOPIC_LOOK[i % TOPIC_LOOK.length] })).filter((g) => !(me.isYouth && g.adultsOnly));
  const groups = all
    .filter((g) => needle || !topic || g.title === topic)
    .map((g) => ({ ...g, items: g.items.filter((i) => !needle || `${i.q} ${i.a}`.toLowerCase().includes(needle)) }))
    .filter((g) => g.items.length);
  const hits = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <Screen
      scroll
      spacer="none"
      header={<SubHeader title={nb.help.title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
    >
      <FadeUp style={styles.px}>
        <View style={[styles.hero, shadow.card]}>
          <View style={styles.heroText}>
            <Text style={[text.eyebrow, styles.lime]}>{nb.help.eyebrow}</Text>
            <Text style={text.h1} accessibilityRole="header">
              {nb.help.heading}
            </Text>
          </View>
          <View style={styles.heroArt}>
            <HelpArt />
          </View>
          <View style={[styles.search, shadow.card]}>
            <Icon name="search" size={18} color={colors.mute} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={nb.help.searchPh}
              placeholderTextColor={colors.mute}
              accessibilityLabel={nb.help.searchPh}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {q ? (
              <Pressable accessibilityRole="button" accessibilityLabel={nb.help.clear} onPress={() => setQ('')} style={styles.clear}>
                <Icon name="x" size={14} color={colors.ink2} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </FadeUp>

      {needle ? null : (
        <FadeUp delay={60} style={[styles.px, styles.topics]}>
          {all.map((g) => {
            const on = topic === g.title;
            return (
              <Pressable
                key={g.title}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${g.title}, ${nb.help.count(g.items.length)}`}
                onPress={() => {
                  haptics.light();
                  setTopic(on ? null : g.title);
                }}
                style={({ pressed }) => [styles.topic, shadow.card, on && styles.topicOn, pressed && styles.pressed]}
              >
                <View style={[styles.topicIcon, { backgroundColor: on ? colors.lime : g.look.bg }]}>
                  <Icon name={g.look.icon} size={18} color={on ? colors.ink : g.look.fg} />
                </View>
                <Text style={[styles.topicTitle, on && styles.white]} numberOfLines={2}>
                  {g.title}
                </Text>
                <Text style={[styles.topicCount, on && styles.onInk]}>{nb.help.count(g.items.length)}</Text>
              </Pressable>
            );
          })}
        </FadeUp>
      )}

      <View style={[styles.px, styles.list]}>
        {needle ? <Text style={text.meta}>{nb.help.hits(hits)}</Text> : null}
        {groups.length ? (
          groups.map((g, i) => (
            <FadeUp key={g.title} delay={Math.min(i, 5) * 50}>
              <View style={styles.groupHead}>
                <View style={[styles.groupIcon, { backgroundColor: g.look.bg }]}>
                  <Icon name={g.look.icon} size={15} color={g.look.fg} />
                </View>
                <Text style={styles.groupTitle}>{g.title}</Text>
              </View>
              <View style={[styles.card, shadow.card]}>
                {g.items.map((item, k) => (
                  <Question key={item.q} q={item.q} a={item.a} first={k === 0} open={!!needle && hits <= 3} />
                ))}
              </View>
            </FadeUp>
          ))
        ) : (
          <FadeUp style={styles.none}>
            <View style={styles.noneIcon}>
              <Icon name="search" size={22} color={colors.cyanDeep} />
            </View>
            <Text style={[text.label, styles.center]}>{nb.help.noHits}</Text>
            <Text style={[text.meta, styles.center]}>{nb.help.noHitsSub}</Text>
          </FadeUp>
        )}

        <FadeUp delay={150}>
          <Text style={styles.linksTitle}>{nb.help.linksTitle}</Text>
          <View style={[styles.card, shadow.card]}>
            {LINKS.map((l, k) => (
              <Pressable key={l.to} accessibilityRole="link" onPress={() => safePush(l.to)} style={({ pressed }) => [styles.link, k > 0 && styles.line, pressed && styles.pressed]}>
                <View style={styles.linkIcon}>
                  <Icon name={l.icon} size={17} color={colors.ink2} />
                </View>
                <Text style={[text.label, styles.flex]}>{l.label}</Text>
                <Icon name="right" size={18} color={colors.faint} />
              </Pressable>
            ))}
          </View>
        </FadeUp>

        <FadeUp delay={200} style={[styles.contact, shadow.medium]}>
          <View style={styles.contactGlow} />
          <View style={styles.contactIcon}>
            <Icon name="msg" size={20} color={colors.ink} />
          </View>
          <Text style={[text.h3, styles.white]}>{nb.help.contactTitle}</Text>
          <Text style={[text.body, styles.contactBody]}>{nb.help.contactBody}</Text>
          <Button label={nb.help.contact} icon="send" flat onPress={() => safePush('/minnabo')} />
        </FadeUp>
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

/** A question that opens to its answer. Search results open by themselves when there are only a few. */
function Question({ q, a, first, open }: { q: string; a: string; first: boolean; open: boolean }) {
  const [shown, setShown] = useState(false);
  const expanded = shown || open;
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(expanded ? '180deg' : '0deg', { duration: 200 }) }] }));
  return (
    <View style={[styles.q, !first && styles.line]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setShown((v) => !v)}
        style={({ pressed }) => [styles.qHead, pressed && styles.pressed]}
      >
        <Text style={[styles.qText, expanded && styles.qTextOpen]}>{q}</Text>
        <Animated.View style={[styles.chev, expanded && styles.chevOpen, turn]}>
          <Icon name="down" size={16} color={expanded ? colors.ink : colors.ink2} />
        </Animated.View>
      </Pressable>
      {expanded ? (
        <Animated.Text entering={FadeIn.duration(180)} style={styles.answer}>
          {a}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  white: { color: colors.white },
  onInk: { color: colors.onInk78 },
  lime: { color: colors.limeDeep },
  pressed: { opacity: 0.8 },
  hero: { marginTop: 8, borderRadius: radius.nav, backgroundColor: colors.limeSoft, overflow: 'hidden', paddingBottom: 16 },
  heroText: { paddingTop: 22, paddingHorizontal: 20, gap: 6 },
  heroArt: { height: 150 },
  search: {
    marginHorizontal: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  searchInput: { ...text.input, flex: 1, height: '100%', fontSize: 15.5 },
  clear: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  topic: { flexBasis: '47%', flexGrow: 1, minHeight: 104, padding: 14, gap: 6, borderRadius: radius.card, backgroundColor: colors.surface },
  topicOn: { backgroundColor: colors.ink },
  topicIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  topicTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  topicCount: { ...text.meta, fontSize: 12.5 },
  list: { marginTop: 22, gap: 22 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  groupIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { ...text.h3, fontSize: 17 },
  card: { borderRadius: radius.card, backgroundColor: colors.surface, overflow: 'hidden' },
  line: { borderTopWidth: 1, borderTopColor: colors.line2 },
  q: { paddingHorizontal: 16 },
  qHead: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  qText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: colors.ink },
  qTextOpen: { fontFamily: fonts.bodyBold },
  chev: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  chevOpen: { backgroundColor: colors.lime },
  answer: { ...text.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2, paddingBottom: 16, paddingRight: 20 },
  none: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  noneIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  linksTitle: { ...text.h3, fontSize: 17, marginBottom: 10 },
  link: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  linkIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  contact: { backgroundColor: colors.ink, borderRadius: radius.listingCard, padding: 20, gap: 8, overflow: 'hidden' },
  contactGlow: { position: 'absolute', right: -60, top: -70, width: 190, height: 190, borderRadius: 95, backgroundColor: colors.onInk08 },
  contactIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  contactBody: { color: colors.onInk78, marginBottom: 8 },
  bottom: { height: 50 },
});
