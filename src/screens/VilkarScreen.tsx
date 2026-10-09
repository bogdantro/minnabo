import { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { TERMS, TERMS_SECTIONS, TERMS_SUMMARY, termsAsText } from '@/content/terms';
import nb from '@/i18n/nb';
import { useConsentRecords } from '@/api/queries';
import { longDate } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FadeUp, Icon, IconButton, ScaleIn, Screen, SubHeader } from '@/components/ui';

/** Vilkår for bruk (design/screens/Vilkar.dc.html). */
export function VilkarScreen() {
  const router = useRouter();
  const { data: consents } = useConsentRecords();
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<number[]>([]);
  const [pct, setPct] = useState(0);
  const [sec, setSec] = useState(0);

  const acceptedAt = consents?.length ? consents[consents.length - 1].createdAt : undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/innstillinger'));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const max = contentSize.height - layoutMeasurement.height;
    const p = max > 0 ? Math.round(Math.min(100, Math.max(0, (y / max) * 100))) : 0;
    let s = 0;
    offsets.current.forEach((o, i) => {
      if (o - 80 <= y) s = i + 1;
    });
    if (p !== pct) setPct(p);
    if (s !== sec) setSec(s);
  };

  const jump = (i: number) => scroll.current?.scrollTo({ y: Math.max(0, (offsets.current[i] ?? 0) - 14), animated: true });
  const current = sec ? nb.vilkar.current(sec, TERMS_SECTIONS[sec - 1].title, pct) : nb.vilkar.version(TERMS.version);

  return (
    <Screen
      header={
        <View style={styles.head}>
          <SubHeader
            title={nb.vilkar.title}
            onBack={back}
            right={
              <IconButton
                icon="download"
                iconSize={18}
                accessibilityLabel={nb.vilkar.share}
                onPress={() => Share.share({ title: nb.vilkar.title, message: termsAsText() }).catch(() => undefined)}
              />
            }
          />
          <Text style={styles.vsub}>{current}</Text>
          <View
            style={styles.vprog}
            accessibilityRole="progressbar"
            accessibilityLabel={nb.vilkar.progress}
            accessibilityValue={{ min: 0, max: 100, now: pct }}
          >
            <View style={[styles.vprogFill, { width: `${pct}%` }]} />
          </View>
        </View>
      }
    >
      <ScrollView ref={scroll} onScroll={onScroll} scrollEventThrottle={32} showsVerticalScrollIndicator={false}>
        <View style={[styles.px, styles.pt18]}>
          <FadeUp style={styles.gap10}>
            <Text style={text.eyebrow}>MinNabo</Text>
            <Text style={text.meta}>{nb.vilkar.owner(TERMS.owner.name, TERMS.owner.orgNr)}</Text>
            <Text style={text.h1} accessibilityRole="header">
              {nb.vilkar.title}
            </Text>
            <Text style={text.meta}>{nb.vilkar.meta(TERMS.version, longDate(TERMS.validFrom), TERMS.readMinutes)}</Text>
            {__DEV__ ? <Jur /> : null}
          </FadeUp>

          <FadeUp delay={60} style={styles.summary}>
            <Text style={styles.summaryTitle}>{nb.vilkar.summaryTitle}</Text>
            <View style={styles.summaryList}>
              {TERMS_SUMMARY.map((s) => (
                <View key={s} style={styles.check}>
                  <Icon name="check" size={16} color={colors.limeDeep} />
                  <Text style={styles.checkText}>{s}</Text>
                </View>
              ))}
            </View>
          </FadeUp>

          <FadeUp delay={120} style={styles.tocWrap}>
            <Text style={text.eyebrow}>{nb.vilkar.toc}</Text>
            <View style={styles.toc} accessibilityLabel={nb.vilkar.toc}>
              {TERMS_SECTIONS.map((s, i) => {
                const on = sec === i + 1;
                return (
                  <Pressable key={s.title} accessibilityRole="link" accessibilityLabel={`${i + 1}. ${s.title}`} onPress={() => jump(i)} style={[styles.tocChip, on && styles.tocOn]}>
                    <Text style={[styles.tocN, on && styles.tocNOn]}>{i + 1}</Text>
                    <Text style={[styles.tocLabel, on && styles.white]}>{s.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          </FadeUp>

          {TERMS_SECTIONS.map((s, i) => (
            <View
              key={s.title}
              style={styles.section}
              onLayout={(e) => {
                offsets.current[i] = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.h2Row}>
                <Text style={styles.h2Num}>{i + 1}</Text>
                <Text style={styles.h2} accessibilityRole="header">
                  {s.title}
                </Text>
              </View>
              <View style={[styles.kort, shadow.card]}>
                <Text style={styles.kortLabel}>{nb.vilkar.short}</Text>
                <Text style={styles.kortText}>{s.short}</Text>
              </View>
              {s.body.map((p) => (
                <Text key={p} style={styles.p}>
                  {p}
                </Text>
              ))}
              {s.link ? (
                <Text style={[styles.p, styles.link]} accessibilityRole="link" onPress={() => safePush(s.link!.route)}>
                  {s.link.label}
                </Text>
              ) : null}
              {__DEV__ ? <Jur /> : null}
            </View>
          ))}

          {acceptedAt ? (
            <View style={styles.accepted}>
              <View style={styles.acceptedIcon}>
                <Icon name="checks" size={18} color={colors.ok} />
              </View>
              <Text style={styles.acceptedText}>
                {nb.vilkar.acceptedPre}
                <Text style={styles.bold}>{longDate(acceptedAt)}</Text>
                {nb.vilkar.acceptedPost}
              </Text>
            </View>
          ) : null}
          <View style={styles.bottom} />
        </View>
      </ScrollView>

      {pct > 12 ? (
        <ScaleIn style={styles.totopWrap}>
          <Pressable accessibilityRole="button" accessibilityLabel={nb.vilkar.toTop} onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })} style={[styles.totop, shadow.large]}>
            <Icon name="up" size={18} color={colors.white} />
            <Text style={styles.totopText}>{nb.vilkar.toTop}</Text>
          </Pressable>
        </ScaleIn>
      ) : null}
    </Screen>
  );
}

/** Dev builds only: marks where the lawyer's final text goes. */
function Jur() {
  return (
    <View style={styles.jur}>
      <Icon name="edit" size={14} color={colors.warn} />
      <Text style={styles.jurText}>{nb.vilkar.jur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  pt18: { paddingTop: 18 },
  gap10: { gap: 10 },
  white: { color: colors.white },
  bold: { fontFamily: fonts.bodyBold, color: colors.ink },
  bottom: { height: 110 },
  head: { backgroundColor: colors.glassBg, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  vsub: { textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 12, color: colors.mute, marginTop: -4, paddingBottom: 6, minHeight: 18 },
  vprog: { height: 3 },
  vprogFill: { height: '100%', backgroundColor: colors.lime, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  summary: { marginTop: 18, padding: 18, borderRadius: radius.card, backgroundColor: colors.limeTint },
  summaryTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  summaryList: { gap: 8, marginTop: 10 },
  check: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  checkText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20.3, color: colors.ink2 },
  tocWrap: { marginTop: 22, marginBottom: 8 },
  toc: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tocChip: { height: 36, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tocOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tocN: { fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.mute },
  tocNOn: { color: colors.lime },
  tocLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink },
  section: { paddingTop: 26, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 14 },
  h2Row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  h2Num: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.limeDeep, backgroundColor: colors.limeTint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, overflow: 'hidden' },
  h2: { flex: 1, fontFamily: fonts.display, fontSize: 21, lineHeight: 25, letterSpacing: -0.42, color: colors.ink },
  kort: { padding: 14, borderRadius: 18, backgroundColor: colors.white, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: colors.limeDot },
  kortLabel: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', color: colors.limeDeep, marginBottom: 6 },
  kortText: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21.75, color: colors.ink },
  p: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24.3, color: colors.ink2, marginBottom: 12 },
  link: { fontFamily: fonts.bodyBold, color: colors.cyanDeep },
  jur: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.jurBorder, backgroundColor: colors.jurBg, marginBottom: 6 },
  jurText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.warn },
  accepted: { marginTop: 20, padding: 18, flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.dashed, backgroundColor: colors.white },
  acceptedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.okTint, alignItems: 'center', justifyContent: 'center' },
  acceptedText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 19.6, color: colors.ink2 },
  totopWrap: { position: 'absolute', right: 18, bottom: 28, zIndex: 20 },
  totop: { height: 46, paddingLeft: 12, paddingRight: 16, borderRadius: radius.pill, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 6 },
  totopText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
});
