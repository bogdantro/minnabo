import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { LendCategory, LendItem } from '@/domain/types';
import nb from '@/i18n/nb';
import { useDeleteLendItem, useLendBusyDays, useLendItems, useLendRequests, useSaveLendItem } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { LEND_ART, LEND_CATEGORIES, dateOf } from '@/domain/lend';
import { dayMonth } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { LendHero } from '@/components/lend/LendHero';
import { LendItemCard } from '@/components/lend/LendItemCard';
import { LendItemSheet } from '@/components/lend/LendItemSheet';
import { LendItemForm } from '@/components/lend/LendItemForm';
import { LendRequestCard } from '@/components/lend/LendRequestCard';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import {
  Button,
  CategoryArt,
  Dialog,
  EmptyState,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  ListingCardSkeleton,
  RowSkeleton,
  Screen,
  SearchField,
  Segmented,
  SubHeader,
  Toggle,
} from '@/components/ui';

type Tab = 'all' | 'mine' | 'asks';

/** «Æ, ø, å» as typed, case ignored; the title and the line about it. */
export function matchesLendSearch(item: Pick<LendItem, 'title' | 'note'>, q: string): boolean {
  const needle = q.trim().toLocaleLowerCase('nb-NO');
  if (!needle) return true;
  return `${item.title} ${item.note ?? ''}`.toLocaleLowerCase('nb-NO').includes(needle);
}

/**
 * Utlån (0101, redesigned 2026-11-13): what neighbours in the kommune lend out – a hero with live numbers, search,
 * kinds with counts and a photo grid; a thing opens in one popup (details, the next 14 days, ask, sent).
 * «Mine ting» and «Forespørsler» for what I lend out and the requests both ways. Youth can borrow, not lend out.
 * `ownerId` = one person's shelf (from a profile).
 */
export function LendScreen({ ownerId, startTab }: { ownerId?: string; startTab?: Tab }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { municipality } = useLocationScope();
  const kommune = me.municipality || municipality || '';
  // youth may lend out too since 0107 (decided 2026-11-13)
  const canLend = !!me.id;
  const [tab, setTab] = useState<Tab>(startTab === 'mine' && !canLend ? 'all' : (startTab ?? 'all'));
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<LendCategory | 'ALL'>('ALL');
  const [open, setOpen] = useState<LendItem | null>(null);
  const [form, setForm] = useState<{ item?: LendItem } | null>(null);
  const t = nb.lend;

  const all = useLendItems(ownerId ? { ownerId } : { municipality: kommune });
  const mine = useLendItems({ ownerId: me.id }, canLend && !!me.id);
  const asks = useLendRequests();

  const others = useMemo(() => (all.data ?? []).filter((i) => i.active && i.ownerId !== me.id), [all.data, me.id]);
  const shown = useMemo(() => others.filter((i) => (cat === 'ALL' || i.category === cat) && matchesLendSearch(i, q)), [others, cat, q]);
  const lenders = useMemo(() => [...new Set(others.map((i) => i.ownerId))], [others]);
  const counts = useMemo(() => {
    const c: Partial<Record<LendCategory, number>> = {};
    for (const i of others) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [others]);
  const incoming = (asks.data ?? []).filter((r) => r.ownerId === me.id);
  const outgoing = (asks.data ?? []).filter((r) => r.borrowerId === me.id);
  const waiting = incoming.filter((r) => r.status === 'PENDING').length;
  const myItems = mine.data ?? [];

  const tabs = [
    { value: 'all' as const, label: t.tabAll },
    ...(canLend && !ownerId ? [{ value: 'mine' as const, label: t.tabMine }] : []),
    { value: 'asks' as const, label: t.tabAsks, count: waiting || undefined },
  ];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/fellesskap'));

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        header={
          <SubHeader
            title={t.title}
            onBack={back}
            right={canLend ? <IconButton icon="plus" iconSize={18} accessibilityLabel={t.addA11y} onPress={() => setForm({})} /> : undefined}
          />
        }
      >
        <View style={styles.body}>
          {tab === 'all' && !ownerId ? (
            <FadeUp>
              <LendHero kommune={kommune} things={others.length} lenders={lenders.length} faces={lenders.slice(0, 2)} onAdd={canLend ? () => setForm({}) : undefined} />
            </FadeUp>
          ) : null}

          {tabs.length > 1 ? <Segmented options={tabs} value={tab} onChange={setTab} accessibilityLabel={t.title} /> : null}

          {tab === 'all' ? (
            <>
              <SearchField placeholder={t.search} value={q} onChangeText={setQ} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
                <KindChip label={t.all} count={others.length} on={cat === 'ALL'} onPress={() => setCat('ALL')} />
                {LEND_CATEGORIES.map((c) => (
                  <KindChip key={c} label={t.cats[c]} kind={c} count={counts[c] ?? 0} on={cat === c} onPress={() => setCat(c)} />
                ))}
              </ScrollView>

              {all.isLoading ? (
                <View style={styles.grid}>
                  <View style={styles.cell}>
                    <ListingCardSkeleton />
                  </View>
                  <View style={styles.cell}>
                    <ListingCardSkeleton />
                  </View>
                </View>
              ) : all.isError ? (
                <ErrorState onRetry={() => void all.refetch()} />
              ) : shown.length ? (
                <>
                  <Text style={styles.count}>{t.resultCount(shown.length)}</Text>
                  <View style={styles.grid}>
                    {shown.map((i, n) => (
                      <FadeUp key={i.id} delay={Math.min(n, 8) * 40} style={styles.cell}>
                        <LendItemCard item={i} onOpen={() => setOpen(i)} />
                      </FadeUp>
                    ))}
                  </View>
                </>
              ) : (
                <EmptyState
                  icon="montering"
                  title={q || cat !== 'ALL' ? t.emptySearchTitle : t.emptyTitle}
                  body={q || cat !== 'ALL' ? t.emptySearch : t.empty(kommune)}
                  actionLabel={canLend && !q && cat === 'ALL' ? t.addCta : undefined}
                  actionIcon="plus"
                  onAction={canLend && !q && cat === 'ALL' ? () => setForm({}) : undefined}
                />
              )}
            </>
          ) : null}

          {tab === 'mine' ? (
            <MineTab items={myItems} loading={mine.isLoading} waiting={waiting} onAdd={() => setForm({})} onEdit={(i) => setForm({ item: i })} onOpen={setOpen} onAsks={() => setTab('asks')} />
          ) : null}

          {tab === 'asks' ? (
            asks.isLoading ? (
              <RowSkeleton />
            ) : asks.isError ? (
              <ErrorState onRetry={() => void asks.refetch()} />
            ) : incoming.length || outgoing.length ? (
              <View style={styles.gap18}>
                {incoming.length ? (
                  <Section title={t.toYou} count={incoming.length}>
                    {incoming.map((r) => (
                      <LendRequestCard key={r.id} r={r} meId={me.id} item={myItems.find((i) => i.id === r.itemId)} />
                    ))}
                  </Section>
                ) : null}
                {outgoing.length ? (
                  <Section title={t.fromYou} count={outgoing.length}>
                    {outgoing.map((r) => (
                      <LendRequestCard key={r.id} r={r} meId={me.id} item={(all.data ?? []).find((i) => i.id === r.itemId)} />
                    ))}
                  </Section>
                ) : null}
              </View>
            ) : (
              <EmptyState icon="msg" title={t.emptyAsksTitle} body={t.emptyAsks} />
            )
          ) : null}
        </View>
        <View style={styles.bottom} />
      </Screen>

      <LendItemSheet item={open} onClose={() => setOpen(null)} onOpenItem={setOpen} onSeeRequests={() => setTab('asks')} />
      {form ? <LendItemForm item={form.item} userId={me.id} kommune={kommune} onClose={() => setForm(null)} /> : null}
    </View>
  );
}

function KindChip({ label, kind, count, on, onPress }: { label: string; kind?: LendCategory; count: number; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}, ${count}`}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      style={({ pressed }) => [styles.kind, on && styles.kindOn, pressed && styles.pressed]}
    >
      {kind ? (
        <CategoryArt category={LEND_ART[kind]} width={28} height={28} radius={14} iconSize={14} />
      ) : (
        <View style={[styles.kindAll, on && styles.kindAllOn]}>
          <Icon name="annet" size={14} color={on ? colors.ink : colors.ink2} />
        </View>
      )}
      <Text style={[styles.kindText, on && styles.kindTextOn]}>{label}</Text>
      <View style={[styles.kindCount, on && styles.kindCountOn]}>
        <Text style={[styles.kindCountText, on && styles.kindCountTextOn]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <View style={styles.gap10}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function MineTab({
  items,
  loading,
  waiting,
  onAdd,
  onEdit,
  onOpen,
  onAsks,
}: {
  items: LendItem[];
  loading: boolean;
  waiting: number;
  onAdd: () => void;
  onEdit: (i: LendItem) => void;
  onOpen: (i: LendItem) => void;
  onAsks: () => void;
}) {
  const t = nb.lend;
  const [removing, setRemoving] = useState<LendItem | null>(null);
  const del = useDeleteLendItem();
  const confirmRemove = () => {
    if (!removing) return;
    del.mutate(removing.id, {
      onSuccess: () => {
        haptics.warning();
        toast.info(t.removed, { icon: 'trash' });
        setRemoving(null);
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });
  };
  if (loading) return <RowSkeleton />;
  return (
    <View style={styles.gap12}>
      {/* a summary on ink, with the way to the requests when someone is waiting */}
      <FadeUp style={[styles.summary, shadow.medium]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryDisc}>
            <Icon name="montering" size={22} color={colors.ink} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.summaryTitle}>{t.mineTitle(items.length)}</Text>
            <Text style={styles.summarySub}>{t.mineSub(waiting)}</Text>
          </View>
        </View>
        {waiting ? <Button label={t.tabAsks} icon="arrow" variant="lime" size="sm" onPress={onAsks} /> : null}
      </FadeUp>

      {items.map((i, n) => (
        <FadeUp key={i.id} delay={Math.min(n, 6) * 40}>
          <MineRow item={i} onEdit={() => onEdit(i)} onOpen={() => onOpen(i)} onRemove={() => setRemoving(i)} />
        </FadeUp>
      ))}

      <Pressable accessibilityRole="button" accessibilityLabel={t.addA11y} onPress={onAdd} style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}>
        <View style={styles.addDisc}>
          <Icon name="plus" size={22} color={colors.ink} />
        </View>
        <View style={styles.flex}>
          <Text style={text.label}>{items.length ? t.add : t.mineEmptyTitle}</Text>
          <Text style={text.meta}>{t.mineEmptyBody}</Text>
        </View>
      </Pressable>

      <Dialog
        visible={!!removing}
        onClose={() => !del.isPending && setRemoving(null)}
        icon="trash"
        tone="danger"
        title={removing ? t.removeTitle(removing.title) : ''}
        body={t.removeBody}
        actions={
          <View style={styles.dlg}>
            <Button label={t.remove} variant="danger" loading={del.isPending} onPress={confirmRemove} />
            <Button label={t.keep} variant="ghost" onPress={() => setRemoving(null)} />
          </View>
        }
      />
    </View>
  );
}

function MineRow({ item, onEdit, onOpen, onRemove }: { item: LendItem; onEdit: () => void; onOpen: () => void; onRemove: () => void }) {
  const t = nb.lend;
  const save = useSaveLendItem();
  const busy = useLendBusyDays(item.id).data ?? [];
  const next = busy[0];
  const toggle = (on: boolean) =>
    save.mutate({ id: item.id, title: item.title, category: item.category, note: item.note, active: on }, { onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)) });
  return (
    <View style={[styles.mine, shadow.card, !item.active && styles.mineOff]}>
      <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={onOpen} style={styles.mineMain}>
        <CategoryArt category={LEND_ART[item.category]} uri={item.imageUrl} width={72} height={72} radius={18} iconSize={28} />
        <View style={styles.flex}>
          <Text style={text.label} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={text.meta}>{t.cats[item.category]}</Text>
          {next ? (
            <View style={styles.loanPill}>
              <Icon name="cal" size={12} color={colors.white} />
              <Text style={styles.loanText}>{t.nextLoan(dayMonth(dateOf(next.fromDate).toISOString()), dayMonth(dateOf(next.toDate).toISOString()))}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.mineFoot}>
        <View style={styles.visibleRow}>
          <Toggle size="sm" value={item.active} onValueChange={toggle} accessibilityLabel={t.visibleA11y(item.title)} />
          <Text style={styles.visibleText}>{item.active ? t.visible : t.hidden}</Text>
        </View>
        <IconButton icon="edit" iconSize={17} accessibilityLabel={t.editA11y(item.title)} onPress={onEdit} />
        <IconButton icon="trash" iconSize={17} accessibilityLabel={t.removeA11y(item.title)} onPress={onRemove} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  body: { paddingHorizontal: screenPadding, paddingTop: 6, gap: 14 },
  gap10: { gap: 10 },
  gap12: { gap: 12 },
  gap18: { gap: 18 },
  pressed: { opacity: 0.8 },
  chipScroll: { marginHorizontal: -screenPadding },
  chips: { gap: 8, paddingHorizontal: screenPadding },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 44, paddingLeft: 7, paddingRight: 8, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  kindOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  kindAll: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  kindAllOn: { backgroundColor: colors.lime },
  kindText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.ink },
  kindTextOn: { color: colors.white },
  kindCount: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  kindCountOn: { backgroundColor: colors.lime },
  kindCountText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink2 },
  kindCountTextOn: { color: colors.ink },
  count: { ...text.eyebrow, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47.5%', flexGrow: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  sectionCount: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { gap: 14, padding: 16, borderRadius: radius.card, backgroundColor: colors.ink },
  summaryDisc: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.white },
  summarySub: { ...text.meta, color: colors.onInk72 },
  mine: { borderRadius: radius.card, backgroundColor: colors.white, padding: 12, gap: 10 },
  mineOff: { opacity: 0.7 },
  mineMain: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  loanPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.ink, marginTop: 4 },
  loanText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.white },
  mineFoot: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line2 },
  visibleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  visibleText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink2 },
  addTile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.limeDeep, backgroundColor: colors.limeTint },
  addDisc: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white },
  dlg: { gap: 10, alignSelf: 'stretch' },
  bottom: { height: 80 },
});
