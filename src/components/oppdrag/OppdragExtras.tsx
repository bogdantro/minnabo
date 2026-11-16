/**
 * The newer parts of the Oppdrag tab (0110): strips of oppdrag (Haster nå, I dag og i morgen, helgevær, Siste
 * sjanse, folk du har hjulpet), «2 oppdrag i samme område», Månedens hjelpere, «Trenger du Jonas igjen?»,
 * the invite card and the card menu.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { AgendaItem, Listing } from '@/domain/types';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { useProfile } from '@/api/queries';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Avatar, Button, CategoryArt, Icon, ListGroup, ListRow, SectionHeader, Sheet, type IconName } from '@/components/ui';

// ------------------------------------------------------------
// A strip of small oppdrag cards
// ------------------------------------------------------------
export function MiniStrip({ title, sub, icon, tone, listings, testID }: { title: string; sub?: string; icon: IconName; tone: 'lime' | 'warn' | 'cyan' | 'ink'; listings: Listing[]; testID?: string }) {
  if (!listings.length) return null;
  const t = { lime: [colors.limeTint, colors.limeDeep], warn: [colors.warnTint, colors.warn], cyan: [colors.cyanTint, colors.cyanDeep], ink: [colors.ink, colors.lime] }[tone];
  return (
    <View testID={testID}>
      <SectionHeader icon={icon} iconBg={t[0]} iconColor={t[1]} title={title} subtitle={sub} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {listings.slice(0, 10).map((l) => (
          <Pressable
            key={l.id}
            accessibilityRole="link"
            accessibilityLabel={`${l.title}, ${l.location.place || l.location.municipality}`}
            onPress={() => safePush(`/oppdrag/${l.id}`)}
            style={({ pressed }) => [styles.mini, shadow.card, pressed && styles.pressed]}
          >
            <CategoryArt category={categoryArtId(l.category.slug)} uri={l.images[0]?.url} width="100%" height={92} radius={14} iconSize={30} />
            <Text style={styles.miniTitle} numberOfLines={2}>
              {l.title}
            </Text>
            <Text style={styles.miniPlace} numberOfLines={1}>
              {l.location.place || l.location.municipality}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ------------------------------------------------------------
// «2 oppdrag i samme område lørdag»
// ------------------------------------------------------------
const DAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
export function combineSuggestion(listings: Listing[], today: string): { place: string; day: string; list: Listing[] } | null {
  const groups = new Map<string, Listing[]>();
  for (const l of listings) {
    for (const d of l.task?.scheduledDays ?? []) {
      if (d < today || !l.location.place) continue;
      const k = `${l.location.place}|${d}`;
      groups.set(k, [...(groups.get(k) ?? []), l]);
    }
  }
  const best = [...groups.entries()].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))[0];
  if (!best) return null;
  const [place, day] = best[0].split('|');
  return { place, day: DAYS[new Date(`${day}T12:00:00`).getDay()], list: best[1] };
}

export function CombineCard({ s }: { s: { place: string; day: string; list: Listing[] } }) {
  return (
    <View style={[styles.px, styles.mt22]}>
      <View style={[styles.combine, shadow.card]} testID="combine-card">
        <View style={styles.combineIc}>
          <Icon name="nav" size={18} color={colors.lime} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{nb.op.sections.combine(s.list.length, s.day)}</Text>
          <Text style={text.meta}>{nb.op.sections.combineSub(s.place)}</Text>
          <View style={styles.combineList}>
            {s.list.slice(0, 3).map((l) => (
              <Pressable key={l.id} accessibilityRole="link" onPress={() => safePush(`/oppdrag/${l.id}`)} style={styles.combineItem}>
                <Icon name="clip" size={13} color={colors.ink2} />
                <Text style={styles.combineText} numberOfLines={1}>
                  {l.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ------------------------------------------------------------
// Månedens hjelpere
// ------------------------------------------------------------
function HelperFace({ id, jobs }: { id: string; jobs: number }) {
  const p = useProfile(id).data;
  if (!p) return null;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${p.displayName}, ${jobs}`} onPress={() => safePush(`/profil/${id}`)} style={styles.hero}>
      <Avatar initials={p.initials} uri={p.avatarUrl} seed={id} size={52} ring={false} />
      <Text style={styles.heroName} numberOfLines={1}>
        {p.displayName.split(' ')[0]}
      </Text>
      <View style={styles.heroJobs}>
        <Icon name="check" size={11} color={colors.ink} />
        <Text style={styles.heroJobsText}>{jobs}</Text>
      </View>
    </Pressable>
  );
}

export function MonthHeroes({ heroes, kommune }: { heroes: { profileId: string; jobs: number }[]; kommune: string }) {
  if (!heroes.length) return null;
  return (
    <View testID="month-heroes">
      <SectionHeader icon="award" iconBg={colors.ink} iconColor={colors.lime} title={nb.op.sections.heroes} subtitle={nb.op.sections.heroesSub(kommune)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {heroes.map((h) => (
          <HelperFace key={h.profileId} id={h.profileId} jobs={h.jobs} />
        ))}
      </ScrollView>
    </View>
  );
}

// ------------------------------------------------------------
// For people who need help
// ------------------------------------------------------------
/** «Trenger du Jonas igjen?»: a job I had done about a year ago, in the same month. */
export function rehireCandidate(agenda: AgendaItem[], now = new Date()): AgendaItem | null {
  return (
    agenda.find((a) => {
      if (a.role !== 'CLIENT' || !a.fullyCompleted || a.cancelled) return false;
      const d = new Date(a.scheduledAt ?? a.agreedAt);
      const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      return months >= 11 && months <= 13;
    }) ?? null
  );
}

export function RehireCard({ item }: { item: AgendaItem }) {
  const p = useProfile(item.counterpartId).data;
  const name = p?.displayName.split(' ')[0] ?? 'hjelperen';
  return (
    <View style={[styles.px, styles.mt22]}>
      <View style={[styles.rehire, shadow.card]} testID="rehire">
        {p ? <Avatar initials={p.initials} uri={p.avatarUrl} seed={p.id} size={48} ring={false} /> : null}
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{nb.op.rehire.title(name)}</Text>
          <Text style={text.meta}>{nb.op.rehire.bodyFor(name, item.listingTitle)}</Text>
          <Button label={nb.op.rehire.cta} variant="lime" size="sm" block={false} icon="repeat" onPress={() => safePush(`/avtale/${item.proposalId}`)} style={styles.mt8} />
        </View>
      </View>
    </View>
  );
}

// ------------------------------------------------------------
// When the kommune has few oppdrag
// ------------------------------------------------------------
export function InviteCard({ kommune, onShare }: { kommune: string; onShare: () => void }) {
  return (
    <View style={[styles.px, styles.mt22]}>
      <View style={[styles.invite, shadow.card]} testID="invite-card">
        <View style={styles.inviteBlob} />
        <Text style={styles.inviteTitle}>{nb.op.invite.title}</Text>
        <Text style={styles.inviteBody}>{nb.op.invite.body(kommune)}</Text>
        <Button label={nb.op.invite.cta} variant="lime" size="sm" block={false} flat icon="share" onPress={onShare} />
      </View>
    </View>
  );
}

// ------------------------------------------------------------
// The card menu (long press)
// ------------------------------------------------------------
export function CardMenuSheet({
  listing,
  saved,
  onClose,
  onSave,
  onShare,
  onHide,
  onHideCat,
  onReport,
}: {
  listing: Listing | null;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
  onHide: () => void;
  onHideCat: () => void;
  onReport: () => void;
}) {
  const cat = listing ? categoryLabel(categoryArtId(listing.category.slug)) : '';
  return (
    <Sheet visible={!!listing} onClose={onClose} title={listing?.title ?? nb.op.menu.title}>
      <ListGroup>
        <ListRow icon="heart" title={saved ? nb.op.menu.unsave : nb.op.menu.save} onPress={onSave} />
        <ListRow icon="share" title={nb.op.menu.share} onPress={onShare} />
        <ListRow icon="eyeoff" title={nb.op.menu.hide} onPress={onHide} />
        <ListRow icon="eyeoff" title={nb.op.menu.hideCat(cat)} onPress={onHideCat} />
        <ListRow icon="flag" title={nb.op.menu.report} onPress={onReport} />
      </ListGroup>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  mt8: { marginTop: 8 },
  mt22: { marginTop: 22 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  strip: { gap: 12, paddingHorizontal: screenPadding, paddingBottom: 6 },
  mini: { width: 156, padding: 8, borderRadius: radius.card, backgroundColor: colors.surface, gap: 6 },
  miniTitle: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18, color: colors.ink, minHeight: 36 },
  miniPlace: { fontFamily: fonts.body, fontSize: 12.5, color: colors.mute },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, color: colors.ink },
  combine: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.card, backgroundColor: colors.surface },
  combineIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  combineList: { marginTop: 8, gap: 4 },
  combineItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30 },
  combineText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.ink2 },
  hero: { width: 82, alignItems: 'center', gap: 4, paddingVertical: 4 },
  heroName: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink },
  heroJobs: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: colors.lime },
  heroJobsText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink },
  rehire: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.card, backgroundColor: colors.surface },
  invite: { padding: 18, borderRadius: radius.card, backgroundColor: colors.ink, overflow: 'hidden', gap: 8, alignItems: 'flex-start' },
  inviteBlob: { position: 'absolute', right: -40, bottom: -60, width: 150, height: 150, borderRadius: 75, backgroundColor: colors.onInk08 },
  inviteTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.white },
  inviteBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.onInk75 },
});
