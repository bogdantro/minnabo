import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import type { NabolagSummary } from '@/api/ApiClient';
import { useNabolagList, useNabolagMembership, useNoticeboard } from '@/api/queries';
import { MyNabolagCards, nabolagHref } from '@/components/community/MyNabolagCards';
import { MAX_NABOLAG } from '@/domain/nabolag';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Button, EmptyState, ErrorState, FadeUp, Icon, ListingListSkeleton, PressableScale, ScaleIn, Screen, SectionHeader, Segmented, SubHeader } from '@/components/ui';

type Sort = 'members' | 'name';
/** The search field shows once a kommune has more nabolag than fit on one screen. */
const SEARCH_FROM = 6;

/**
 * Fellesskap → Nabolag: the nabolag MinNabo has set up in my kommune (redesigned 2026-11-10). A hero with my
 * three places (ring discs from the base design), «Foreslått for deg» when my own area is a nabolag, my
 * nabolag, then all of them with search, sorting and how lively each one is. Members get a varsel about new
 * oppslag there.
 */
export function NabolagList() {
  const router = useRouter();
  const me = useCurrentUser();
  const scope = useLocationScope();
  const kommune = me.municipality || scope.municipality || '';
  const { data, isLoading, isError, refetch } = useNabolagList(kommune);
  const membership = useNabolagMembership();
  const posts = useNoticeboard().data ?? [];
  const [now] = useState(() => Date.now());
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('members');

  const list = useMemo(() => data ?? [], [data]);
  const joined = list.filter((n) => n.isMember);
  const mine = joined.length;
  const full = mine >= MAX_NABOLAG;
  const most = Math.max(1, ...list.map((n) => n.memberCount));
  const top = list.reduce<NabolagSummary | null>((best, n) => (!best || n.memberCount > best.memberCount ? n : best), null);
  // my own area, when it is a nabolag I am not in yet
  const suggested = list.find((n) => !n.isMember && !!me.place && n.place.toLocaleLowerCase('nb-NO') === me.place.toLocaleLowerCase('nb-NO'));

  const shown = useMemo(() => {
    const query = q.trim().toLocaleLowerCase('nb-NO');
    const hits = query ? list.filter((n) => n.place.toLocaleLowerCase('nb-NO').includes(query)) : list;
    return [...hits].sort((a, b) => (sort === 'name' ? a.place.localeCompare(b.place, 'nb-NO') : b.memberCount - a.memberCount || a.place.localeCompare(b.place, 'nb-NO')));
  }, [list, q, sort]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/fellesskap'));

  const toggle = (n: NabolagSummary) => {
    const join = !n.isMember;
    if (join && full) {
      haptics.warning();
      toast.error(nb.neighbourhood.full(MAX_NABOLAG));
      return;
    }
    haptics.light();
    membership.mutate(
      { id: n.id, join },
      {
        onSuccess: () =>
          toast.success(join ? nb.neighbourhood.joinedToast(n.name) : nb.neighbourhood.leftToast(n.name), { icon: join ? 'users' : 'logout' }),
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
  };

  if (!kommune) {
    return (
      <Screen header={<SubHeader title={nb.neighbourhood.title} onBack={back} />}>
        <EmptyState icon="home" title={nb.neighbourhood.title} body={nb.neighbourhood.noArea} actionLabel={nb.neighbourhood.pickArea} onAction={() => safePush('/profil/rediger')} />
      </Screen>
    );
  }

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.neighbourhood.title} onBack={back} />}>
      {/* hero: what nabolag are, and my three places */}
      <FadeUp style={styles.px}>
        <View style={[styles.hero, shadow.card]}>
          <View style={[styles.blob, styles.blobL]} />
          <View style={[styles.blob, styles.blobR]} />
          <Text style={[text.eyebrow, styles.heroEyebrow]}>{nb.neighbourhood.listEyebrow(kommune)}</Text>
          <Text style={[text.h1, styles.heroTitle]} accessibilityRole="header">
            {nb.neighbourhood.listHeading}
          </Text>
          <Text style={[text.body, styles.ink2]}>{nb.neighbourhood.listLead(MAX_NABOLAG)}</Text>
          {list.length ? (
            <View style={styles.slots}>
              <View style={styles.slotRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {Array.from({ length: MAX_NABOLAG }, (_, i) => {
                  const n = joined[i];
                  return (
                    <View key={i} style={[styles.slot, i > 0 && styles.slotOverlap, n ? styles.slotOn : styles.slotOff]}>
                      {n ? (
                        <ScaleIn>
                          <View style={styles.slotDisc}>
                            <Icon name="check" size={18} color={colors.ink} />
                          </View>
                        </ScaleIn>
                      ) : (
                        <Icon name="plus" size={18} color={colors.faint} />
                      )}
                    </View>
                  );
                })}
              </View>
              <View style={styles.flex}>
                <Text style={styles.slotCount}>{nb.neighbourhood.counter(mine, MAX_NABOLAG)}</Text>
                <Text style={text.meta} numberOfLines={2}>
                  {joined.length ? joined.map((n) => n.place).join(', ') : nb.neighbourhood.slotsEmpty}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </FadeUp>

      {/* my own area, one tap away */}
      {suggested && !full ? (
        <FadeUp delay={60} style={[styles.px, styles.mt16]}>
          <View style={[styles.suggest, shadow.card]}>
            <View style={styles.suggestIcon}>
              <Icon name="sparkle" size={20} color={colors.limeDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={[text.eyebrow, styles.suggestEyebrow]}>{nb.neighbourhood.suggestEyebrow}</Text>
              <Text style={styles.suggestTitle}>{nb.neighbourhood.suggestTitle(suggested.place)}</Text>
              <Text style={text.meta}>{nb.neighbourhood.rowMembers(suggested.memberCount)}</Text>
            </View>
            <Button label={nb.neighbourhood.join} icon="plus" size="sm" block={false} accessibilityLabel={nb.neighbourhood.suggestJoinAria(suggested.place)} onPress={() => toggle(suggested)} />
          </View>
        </FadeUp>
      ) : null}

      {joined.length ? (
        <>
          <SectionHeader title={nb.neighbourhood.mineTitle} icon="home" iconBg={colors.limeTint} iconColor={colors.limeDeep} style={styles.mt26} />
          <View style={styles.px}>
            <MyNabolagCards nabolag={joined} posts={posts} now={now} />
          </View>
        </>
      ) : null}

      <SectionHeader title={nb.neighbourhood.allIn(kommune)} subtitle={nb.neighbourhood.allInSub} icon="map" style={styles.mt26} />
      <View style={[styles.px, styles.tools]}>
        {list.length >= SEARCH_FROM ? (
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.mute} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={nb.neighbourhood.searchPh}
              placeholderTextColor={colors.mute}
              accessibilityLabel={nb.neighbourhood.searchPh}
              style={[text.input, styles.searchInput]}
            />
            {q ? (
              <Pressable accessibilityRole="button" accessibilityLabel={nb.neighbourhood.searchClear} onPress={() => setQ('')} style={styles.searchClr}>
                <Icon name="x" size={16} color={colors.ink2} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {list.length > 1 ? (
          <Segmented
            accessibilityLabel={nb.neighbourhood.sortLabel}
            value={sort}
            onChange={(v) => setSort(v)}
            options={[
              { value: 'members', label: nb.neighbourhood.sortMembers },
              { value: 'name', label: nb.neighbourhood.sortName },
            ]}
          />
        ) : null}
      </View>

      <View style={[styles.px, styles.list]}>
        {isLoading ? (
          <ListingListSkeleton />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : shown.length ? (
          shown.map((n, i) => (
            <FadeUp key={n.id} delay={Math.min(i, 6) * 40}>
              <NabolagRow n={n} share={n.memberCount / most} popular={!!top && top.id === n.id && top.memberCount > 1} onToggle={() => toggle(n)} />
            </FadeUp>
          ))
        ) : list.length ? (
          <Text style={[text.meta, styles.none]}>{nb.neighbourhood.searchNone(q.trim())}</Text>
        ) : (
          <EmptyState icon="home" title={nb.neighbourhood.title} body={nb.neighbourhood.none(kommune)} />
        )}
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

/** One nabolag: a ring disc, the name, how many are in it (with a bar for how lively it is) and Bli med / Forlat. */
function NabolagRow({ n, share, popular, onToggle }: { n: NabolagSummary; share: number; popular: boolean; onToggle: () => void }) {
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={nb.neighbourhood.rowAria(n.place, n.memberCount, n.isMember)}
      onPress={() => safePush(nabolagHref(n))}
      scaleTo={0.985}
      style={[styles.row, n.isMember && styles.rowOn, shadow.card]}
    >
      <View style={[styles.ring, n.isMember ? styles.ringOn : styles.ringOff]}>
        <View style={[styles.disc, n.isMember && styles.discOn]}>
          <Icon name={n.isMember ? 'check' : 'home'} size={19} color={n.isMember ? colors.limeDeep : colors.ink2} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {n.place}
          </Text>
          {popular ? (
            <View style={styles.popular}>
              <Icon name="zap" size={11} color={colors.warn} />
              <Text style={styles.popularText}>{nb.neighbourhood.popular}</Text>
            </View>
          ) : null}
        </View>
        <Text style={text.meta}>{nb.neighbourhood.rowMembers(n.memberCount)}</Text>
        <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.barFill, { width: `${Math.max(6, Math.round(share * 100))}%` }]} />
        </View>
      </View>
      {n.isMember ? (
        <Button label={nb.neighbourhood.leave} variant="ghost" size="sm" block={false} accessibilityLabel={nb.neighbourhood.leaveAria(n.place)} onPress={onToggle} />
      ) : (
        <Button label={nb.neighbourhood.join} variant="lime" size="sm" block={false} accessibilityLabel={nb.neighbourhood.joinAria(n.place)} onPress={onToggle} />
      )}
    </PressableScale>
  );
}

const SLOT = 52;

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  ink2: { color: colors.ink2 },
  mt16: { marginTop: 16 },
  mt26: { marginTop: 26 },
  bottom: { height: 60 },
  hero: { marginTop: 8, padding: 18, gap: 8, borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobL: { width: 220, height: 220, right: -90, top: -110, backgroundColor: colors.limeTint },
  blobR: { width: 150, height: 150, right: 40, top: -100, backgroundColor: colors.cyanTint, opacity: 0.7 },
  heroEyebrow: { color: colors.limeDeep },
  heroTitle: { fontSize: 30, lineHeight: 33 },
  slots: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: radius.card, backgroundColor: colors.bg },
  slotRow: { flexDirection: 'row' },
  slotOverlap: { marginLeft: -8 },
  slot: { width: SLOT, height: SLOT, borderRadius: SLOT / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  slotOn: { borderWidth: 2.5, borderColor: colors.lime },
  slotOff: { borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed' },
  slotDisc: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  slotCount: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.limeTint },
  suggestIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  suggestEyebrow: { fontSize: 10.5, color: colors.limeDeep },
  suggestTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.ink },
  tools: { gap: 10, marginBottom: 12 },
  search: { height: 46, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 5 },
  searchInput: { flex: 1, height: '100%', fontSize: 15.5 },
  searchClr: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 10 },
  none: { textAlign: 'center', paddingVertical: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.white },
  rowOn: { borderWidth: 1.5, borderColor: colors.limeTint },
  ring: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ringOn: { borderWidth: 2, borderColor: colors.lime },
  ringOff: { borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed' },
  disc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.neutralPill, alignItems: 'center', justifyContent: 'center' },
  discOn: { backgroundColor: colors.limeTint },
  body: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  popular: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: colors.warnTint },
  popularText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.warn },
  bar: { height: 5, borderRadius: 3, backgroundColor: colors.line2, overflow: 'hidden', marginTop: 3, maxWidth: 140 },
  barFill: { height: 5, borderRadius: 3, backgroundColor: colors.lime },
});
