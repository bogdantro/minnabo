/**
 * The newer parts of the Fellesskap tab (0108): «Denne uka i nabolaget», «Ukas bilde», the search entry,
 * the nabolag filter, farevarsler, «Jeg kan hjelpe i dag», «Nye naboer», «Mer i nabolaget», the youth corner,
 * nabotilbud, the support vote and «Tips en bedrift». Each part hides itself when it has nothing to show.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { NoticeboardPost, Partner } from '@/domain/types';
import type { NabolagSummary } from '@/api/ApiClient';
import {
  useCommunitySummary,
  useOrganisations,
  useSupportVotes,
  useTipBusiness,
  useVoteSupport,
  useAreaPhotos,
} from '@/api/communityQueries';
import { useMetAlert } from '@/lib/metAlerts';
import { formatPrice, nok } from '@/domain/price';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Image } from '@/components/ui/Image';
import { Button, Field, GrowBar, Icon, Input, ListGroup, ListRow, PressableScale, SectionHeader, Sheet, type IconName } from '@/components/ui';

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

// ------------------------------------------------------------
// «Denne uka i nabolaget» + the kommune pulse (light card, asked 2026-11-15; «Ditt år» removed)
// ------------------------------------------------------------
export function WeekCard({ kommune }: { kommune: string }) {
  const summary = useCommunitySummary(kommune).data;
  if (!kommune || !summary) return null;
  const month = MONTHS[new Date().getMonth()];
  const stats: { n: number; label: string; icon: IconName; bg: string; fg: string }[] = [
    { n: summary.weekJobs, label: nb.felles.week.jobs, icon: 'check', bg: colors.lime, fg: colors.ink },
    { n: summary.weekNotices, label: nb.felles.week.notices, icon: 'pinned', bg: colors.cyanTint, fg: colors.cyanDeep },
    { n: summary.weekEvents, label: nb.felles.week.events, icon: 'cal', bg: colors.lavenderTint, fg: colors.lavender },
  ];
  return (
    <View style={[styles.px, styles.mt22]}>
      <View
        style={[styles.week, shadow.medium]}
        testID="felles-week"
        accessible
        accessibilityLabel={`${nb.felles.week.title}. ${stats.map((x) => `${x.n} ${x.label}`).join(', ')}. ${
          summary.monthHelped ? nb.felles.week.pulse(kommune, summary.monthHelped, month) : nb.felles.week.pulseNone(kommune)
        }`}
      >
        {/* the base design's shapes: a blob, a dashed ring and a small disc */}
        <View style={styles.weekBlob} />
        <View style={styles.weekRing} />
        <View style={styles.weekDot} />

        <View style={styles.weekHead}>
          <View style={styles.weekBadge}>
            <Icon name="sparkle" size={13} color={colors.ink} />
            <Text style={styles.weekBadgeText}>{nb.felles.week.title}</Text>
          </View>
        </View>

        {/* the kommune pulse is the headline: one big number */}
        <View style={styles.weekHero}>
          <Text style={styles.weekBig} accessibilityElementsHidden>
            {summary.monthHelped || '·'}
          </Text>
          <View style={styles.flex}>
            <Text style={styles.weekHeroTitle}>{summary.monthHelped ? nb.felles.week.heroTitle(summary.monthHelped) : nb.felles.week.heroTitleNone}</Text>
            <Text style={styles.weekHeroSub}>{summary.monthHelped ? nb.felles.week.heroSub(kommune, month) : nb.felles.week.pulseNone(kommune)}</Text>
          </View>
        </View>

        <View style={styles.weekStats}>
          {stats.map((x) => (
            <View key={x.label} style={styles.weekStat}>
              <View style={[styles.weekIcon, { backgroundColor: x.bg }]}>
                <Icon name={x.icon} size={14} color={x.fg} />
              </View>
              <Text style={styles.weekNum}>{x.n}</Text>
              <Text style={styles.weekLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {x.label}
              </Text>
            </View>
          ))}
        </View>

      </View>
    </View>
  );
}

// ------------------------------------------------------------
// «Ukas bilde»
// ------------------------------------------------------------
/** `inset`: the side margin; Oppslagstavla's cards sit closer to the edge than the rest of the app. */
export function AreaPhotoCard({ kommune, inset = screenPadding }: { kommune: string; inset?: number }) {
  const photos = useAreaPhotos(kommune).data ?? [];
  const top = photos[0];
  if (!kommune) return null;
  if (!top) {
    return (
      <View style={[styles.mt12, { paddingHorizontal: inset }]}>
        <PressableScale accessibilityRole="link" onPress={() => safePush('/ukas-bilde')} style={styles.photoEmpty}>
          <View style={[styles.weekIcon, { backgroundColor: colors.cyanTint }]}>
            <Icon name="camera" size={16} color={colors.cyanDeep} />
          </View>
          <Text style={[text.meta, styles.flex]}>{nb.felles.photos.empty}</Text>
          <Icon name="right" size={16} color={colors.faint} />
        </PressableScale>
      </View>
    );
  }
  return (
    <View style={[styles.mt12, { paddingHorizontal: inset }]}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${nb.felles.photos.winner}: ${top.caption}. ${nb.felles.photos.by(top.by)}. ${nb.felles.photos.seeAll}`}
        onPress={() => safePush('/ukas-bilde')}
        scaleTo={0.985}
        style={[styles.photoCard, shadow.card]}
        testID="ukas-bilde"
      >
        <Image source={{ uri: top.url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        <View style={styles.photoPill}>
          <Icon name="award" size={13} color={colors.ink} />
          <Text style={styles.photoPillText}>{nb.felles.photos.winner}</Text>
        </View>
        <View style={styles.photoFoot}>
          <View style={styles.flex}>
            {top.caption ? (
              <Text style={styles.photoCaption} numberOfLines={1}>
                {top.caption}
              </Text>
            ) : null}
            <Text style={styles.photoBy}>{nb.felles.photos.by(top.by)}</Text>
          </View>
          <View style={styles.photoLikes}>
            <Icon name="heart" size={14} color={colors.heart} filled />
            <Text style={styles.photoLikesText}>{top.likes}</Text>
          </View>
        </View>
      </PressableScale>
    </View>
  );
}

// ------------------------------------------------------------
// Search entry and the nabolag filter
// ------------------------------------------------------------
export function FellesSearchLink() {
  return (
    <View style={[styles.px, styles.mt12]}>
      <Pressable accessibilityRole="search" accessibilityLabel={nb.felles.search.a11y} onPress={() => safePush('/fellesskap-sok')} style={[styles.search, shadow.card]}>
        <Icon name="search" size={18} color={colors.mute} />
        <Text style={styles.searchText} numberOfLines={1}>
          {nb.felles.search.ph}
        </Text>
      </Pressable>
    </View>
  );
}

export function NabolagFilter({ nabolag, value, onChange }: { nabolag: NabolagSummary[]; value: string | null; onChange: (id: string | null) => void }) {
  if (nabolag.length < 2) return null;
  const all = [{ id: null as string | null, label: nb.felles.nabolag.filterAll }, ...nabolag.map((n) => ({ id: n.id as string | null, label: n.place }))];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
      style={styles.mt12}
      accessibilityRole="radiogroup"
      accessibilityLabel={nb.felles.nabolag.filterA11y}
    >
      {all.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id ?? 'all'}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={[styles.fchip, on && styles.fchipOn]}
          >
            {o.id ? <Icon name="home" size={14} color={on ? colors.lime : colors.ink2} /> : null}
            <Text style={[styles.fchipText, on && styles.fchipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ------------------------------------------------------------
// Farevarsel (MET) with «Trenger noen hjelp?»
// ------------------------------------------------------------
export function WeatherAlertCard({ kommune, youth }: { kommune: string; youth: boolean }) {
  const alert = useMetAlert(kommune || undefined).data;
  if (!alert) return null;
  const snow = /snø/i.test(alert.title);
  const tone = alert.level === 'red' ? { bg: colors.dangerTint, fg: colors.danger } : alert.level === 'orange' ? { bg: colors.warnTint, fg: colors.warnDark } : { bg: colors.warnTint, fg: colors.warn };
  return (
    <View style={[styles.px, styles.mt12]}>
      <View style={[styles.alert, { backgroundColor: tone.bg }]} testID="met-alert" accessible accessibilityLabel={`${nb.felles.weather.eyebrow}: ${alert.title}. ${nb.felles.weather.levels[alert.level]}`}>
        <View style={styles.alertHead}>
          <View style={[styles.weekIcon, { backgroundColor: colors.white }]}>
            <Icon name={snow ? 'snomaking' : 'alert'} size={16} color={tone.fg} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.alertEyebrow, { color: tone.fg }]}>{`${nb.felles.weather.eyebrow} · ${nb.felles.weather.levels[alert.level]}`}</Text>
            <Text style={styles.alertTitle}>{alert.title}</Text>
          </View>
        </View>
        {alert.description ? (
          <Text style={[text.meta, styles.ink2]} numberOfLines={3}>
            {alert.description}
          </Text>
        ) : null}
        {!youth ? (
          <View style={styles.alertHelp}>
            <Text style={styles.alertHelpTitle}>{nb.felles.weather.help}</Text>
            <Text style={text.meta}>{nb.felles.weather.helpSub}</Text>
            <Button label={nb.felles.weather.post} variant="ink" size="sm" block={false} icon="plus" onPress={() => safePush(snow ? '/legg-ut?kategori=snomaking' : '/legg-ut')} />
          </View>
        ) : null}
        <Text style={styles.alertSource}>{nb.felles.weather.source}</Text>
      </View>
    </View>
  );
}

// ------------------------------------------------------------
// «Mer i nabolaget» – a menu on Oppslagstavla since 2026-11-16 (it was a tile grid on Fellesskap).
// «Ukas bilde» is not in it: that card already sits on the board.
// ------------------------------------------------------------
type MoreRow = { key: string; label: string; sub: string; icon: IconName; bg: string; fg: string; path: string };

/** The rows of the menu; youth get no Sesongsjekk (a home-owner thing). */
export function moreRows(youth: boolean): MoreRow[] {
  return [
    { key: 'orgs', label: nb.felles.more.orgs, sub: nb.felles.more.orgsSub, icon: 'award', bg: colors.limeTint, fg: colors.limeDeep, path: '/foreninger' },
    { key: 'projects', label: nb.felles.more.projects, sub: nb.felles.more.projectsSub, icon: 'hand', bg: colors.cyanTint, fg: colors.cyanDeep, path: '/prosjekter' },
    { key: 'buddies', label: nb.felles.more.buddies, sub: nb.felles.more.buddiesSub, icon: 'smile', bg: colors.okTint, fg: colors.okText, path: '/naboskap' },
    ...(!youth ? [{ key: 'season', label: nb.felles.more.season, sub: nb.felles.more.seasonSub, icon: 'home' as IconName, bg: colors.warnTint, fg: colors.warn, path: '/sesongsjekk' }] : []),
  ];
}

export function MoreMenuSheet({ visible, onClose, youth, kommune }: { visible: boolean; onClose: () => void; youth: boolean; kommune: string }) {
  const [tip, setTip] = useState(false);
  // close first, so the next screen or sheet doesn't open under this one
  const go = (path: string) => {
    onClose();
    safePush(path);
  };
  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={nb.felles.more.title} subtitle={nb.felles.more.sub}>
        <View testID="felles-more">
          <ListGroup>
            {moreRows(youth).map((r) => (
              <ListRow key={r.key} icon={r.icon} iconBg={r.bg} iconColor={r.fg} title={r.label} subtitle={r.sub} onPress={() => go(r.path)} testID={`more-${r.key}`} />
            ))}
          </ListGroup>
          {!youth ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${nb.felles.more.tip}. ${nb.felles.more.tipSub}`}
              onPress={() => {
                onClose();
                setTip(true);
              }}
              scaleTo={0.98}
              style={[styles.tipRow, styles.tipGap]}
            >
              <View style={styles.tipIcon}>
                <Icon name="plus" size={16} color={colors.ink} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.tileLabel}>{nb.felles.more.tip}</Text>
                <Text style={styles.tileSub}>{nb.felles.more.tipSub}</Text>
              </View>
              <Icon name="building" size={18} color={colors.mute} />
            </PressableScale>
          ) : null}
        </View>
      </Sheet>
      <TipBusinessSheet visible={tip} onClose={() => setTip(false)} kommune={kommune} />
    </>
  );
}

// ------------------------------------------------------------
// Youth corner
// ------------------------------------------------------------
export function YouthCorner({ events }: { events: NoticeboardPost[] }) {
  return (
    <View style={[styles.px, styles.mt22]}>
      <View style={[styles.youth, shadow.card]} testID="youth-corner">
        <View style={styles.youthBlob} />
        <Text style={[text.eyebrow, { color: colors.lime }]}>{nb.felles.youthCorner.title}</Text>
        <Text style={styles.youthTitle}>{nb.felles.youthCorner.sub}</Text>
        <Text style={styles.youthLine}>{events.length ? `${nb.felles.youthCorner.events}: ${events.length}` : nb.felles.youthCorner.noEvents}</Text>
        <View style={styles.youthBtns}>
          {events.length ? (
            <Button label={nb.felles.youthCorner.events} variant="lime" size="sm" flat block={false} icon="cal" onPress={() => safePush('/oppslagstavle')} />
          ) : null}
          <Button label={nb.felles.youthCorner.jobs} variant="ghost" size="sm" flat block={false} iconRight="arrow" onPress={() => safePush('/ung')} />
        </View>
      </View>
    </View>
  );
}

// ------------------------------------------------------------
// Nabotilbud from partners
// ------------------------------------------------------------
export function NeighbourOffers({ partners }: { partners: Partner[] }) {
  const withOffer = partners.filter((p) => p.offer);
  if (!withOffer.length) return null;
  return (
    <>
      <SectionHeader icon="tag" iconBg={colors.warnTint} iconColor={colors.warn} title={nb.felles.offers.title} subtitle={nb.felles.offers.sub} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newRow}>
        {withOffer.map((p) => (
          <PressableScale
            key={p.id}
            accessibilityRole={p.featured ? 'link' : 'text'}
            accessibilityLabel={p.featured ? nb.felles.offers.see(p.name) : `${p.name}: ${p.offer}`}
            // only hovedpartnere have their own page
            disabled={!p.featured}
            onPress={() => safePush(`/partner/${p.id}`)}
            scaleTo={0.97}
            style={[styles.offer, shadow.card]}
          >
            <View style={[styles.tileIcon, { backgroundColor: colors.warnTint }]}>
              <Icon name="tag" size={16} color={colors.warn} />
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={[text.meta, styles.ink2]} numberOfLines={3}>
              {p.offer}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </>
  );
}

// ------------------------------------------------------------
// «Stem på neste støtte» and the next payout
// ------------------------------------------------------------
export function SupportCard({ kommune }: { kommune: string }) {
  const state = useSupportVotes(kommune).data;
  const orgs = useOrganisations(kommune).data ?? [];
  const vote = useVoteSupport(kommune);
  if (!kommune || (!orgs.length && !state?.goal)) return null;
  const ranked = [...orgs].sort((a, b) => (state?.counts[b.id] ?? 0) - (state?.counts[a.id] ?? 0)).slice(0, 3);
  const goal = state?.goal;
  return (
    <View style={[styles.px, styles.mt12]}>
      <View style={[styles.support, shadow.card]} testID="support-card">
        {goal ? (
          <View style={styles.supportGoal}>
            <Text style={styles.todayTitle}>{nb.felles.support.progressTitle}</Text>
            <GrowBar fill={Math.min(1, goal.collectedKr / goal.goalKr)} color={colors.limeDeep} height={10} />
            <Text style={text.meta}>{nb.felles.support.progress(formatPrice(nok(goal.collectedKr)), formatPrice(nok(goal.goalKr)))}</Text>
            <Text style={text.hint}>{nb.felles.support.progressNote}</Text>
          </View>
        ) : null}
        {ranked.length ? (
          <>
            <Text style={[styles.todayTitle, goal && styles.mt12]}>{nb.felles.support.title}</Text>
            {state?.round ? <Text style={[text.meta, styles.mb8]}>{nb.felles.support.sub(state.round)}</Text> : null}
            {ranked.map((o) => {
              const mine = state?.mine === o.id;
              return (
                <View key={o.id} style={styles.voteRow}>
                  <View style={styles.flex}>
                    <Text style={styles.voteName} numberOfLines={1}>
                      {o.name}
                    </Text>
                    <Text style={text.hint}>{nb.felles.support.votes(state?.counts[o.id] ?? 0)}</Text>
                  </View>
                  <Button
                    label={mine ? nb.felles.support.voted : nb.felles.support.vote}
                    variant={mine ? 'ink' : 'ghost'}
                    size="sm"
                    block={false}
                    icon={mine ? 'check' : undefined}
                    accessibilityLabel={`${nb.felles.support.vote}: ${o.name}`}
                    onPress={() =>
                      vote.mutate(o.id, {
                        onSuccess: () => toast.success(nb.felles.support.votedToast),
                        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
                      })
                    }
                  />
                </View>
              );
            })}
            <Pressable accessibilityRole="link" onPress={() => safePush('/foreninger')} style={styles.yearLink} hitSlop={6}>
              <Text style={styles.yearLinkText}>{nb.felles.support.seeAll}</Text>
              <Icon name="right" size={15} color={colors.ink} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

// ------------------------------------------------------------
// «Tips en bedrift»
// ------------------------------------------------------------
export function TipBusinessSheet({ visible, onClose, kommune }: { visible: boolean; onClose: () => void; kommune: string }) {
  const [name, setName] = useState('');
  const [why, setWhy] = useState('');
  const tip = useTipBusiness();
  const send = () =>
    tip.mutate(
      { name: name.trim(), why: why.trim(), municipality: kommune },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(nb.felles.partner.tipSent);
          setName('');
          setWhy('');
          onClose();
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={nb.felles.partner.tipTitle}
      subtitle={nb.felles.partner.tipSub}
      footer={<Button label={nb.felles.partner.tipSend} variant="lime" icon="send" disabled={name.trim().length < 2} loading={tip.isPending} onPress={send} />}
    >
      <Field label={nb.felles.partner.tipName}>
        <Input value={name} onChangeText={setName} placeholder={nb.felles.partner.tipNamePh} maxLength={100} accessibilityLabel={nb.felles.partner.tipName} />
      </Field>
      <Field label={nb.felles.partner.tipWhy} style={styles.mt12}>
        <Input value={why} onChangeText={setWhy} placeholder={nb.felles.partner.tipWhyPh} maxLength={400} multiline accessibilityLabel={nb.felles.partner.tipWhy} />
      </Field>
    </Sheet>
  );
}


const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  mt22: { marginTop: 22 },
  mt12: { marginTop: 12 },
  mb8: { marginBottom: 8 },
  flex: { flex: 1 },
  ink2: { color: colors.ink2 },

  week: { padding: 18, borderRadius: radius.card, backgroundColor: colors.surface, overflow: 'hidden', gap: 16 },
  weekBlob: { position: 'absolute', right: -60, top: -70, width: 190, height: 190, borderRadius: 95, backgroundColor: colors.limeTint },
  weekRing: { position: 'absolute', right: 16, top: 12, width: 44, height: 44, borderRadius: 32, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.limeDeep, opacity: 0.55 },
  weekDot: { position: 'absolute', right: 64, top: 18, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cyan },
  weekHead: { flexDirection: 'row' },
  weekBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.lime },
  weekBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.ink },
  weekHero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  weekBig: { fontFamily: fonts.displayHeavy, fontSize: 58, lineHeight: 62, letterSpacing: -2, color: colors.ink },
  weekHeroTitle: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, color: colors.ink },
  weekHeroSub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18, color: colors.mute, marginTop: 2 },
  weekStats: { flexDirection: 'row', gap: 8 },
  weekStat: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.tile, backgroundColor: colors.surface2, gap: 4 },
  weekIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  weekNum: { fontFamily: fonts.display, fontSize: 24, lineHeight: 27, color: colors.ink },
  weekLabel: { fontFamily: fonts.bodyMedium, fontSize: 11.5, lineHeight: 15, color: colors.mute },
  yearLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44 },
  yearLinkText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },

  photoCard: { height: 190, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface2, justifyContent: 'space-between' },
  photoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', margin: 12, paddingHorizontal: 10, height: 28, borderRadius: radius.pill, backgroundColor: colors.lime },
  photoPillText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  photoFoot: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, margin: 10, padding: 10, borderRadius: radius.tile, backgroundColor: colors.surface },
  photoCaption: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  photoBy: { fontFamily: fonts.body, fontSize: 12.5, color: colors.mute },
  photoLikes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoLikesText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  photoEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line2 },

  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface },
  searchText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.mute },

  filterRow: { paddingHorizontal: screenPadding, gap: 8 },
  fchip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line2 },
  fchipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  fchipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  fchipTextOn: { color: colors.white },

  alert: { padding: 16, borderRadius: radius.card, gap: 10 },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertEyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.mute },
  alertTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.ink },
  alertHelp: { padding: 12, borderRadius: radius.tile, backgroundColor: colors.surface, gap: 6 },
  alertHelpTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  alertSource: { fontFamily: fonts.body, fontSize: 11.5, color: colors.mute },

  todayTitle: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, color: colors.ink },

  newRow: { paddingHorizontal: screenPadding, gap: 12, paddingBottom: 6 },

  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19, color: colors.ink },
  tileSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.ink2 },
  tipRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  tipGap: { marginTop: 12 },
  tipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },

  youth: { padding: 18, borderRadius: radius.card, backgroundColor: colors.ink, overflow: 'hidden', gap: 8 },
  youthBlob: { position: 'absolute', right: -30, bottom: -50, width: 140, height: 140, borderRadius: 70, backgroundColor: colors.onInk08 },
  youthTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, color: colors.white },
  youthLine: { fontFamily: fonts.body, fontSize: 14, color: colors.onInk75 },
  youthBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },

  offer: { width: 220, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface, gap: 6 },

  support: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surface },
  supportGoal: { gap: 6 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line2 },
  voteName: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.ink },

});
