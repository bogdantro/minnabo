import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LendItem } from '@/domain/types';
import nb from '@/i18n/nb';
import { useLendBusyDays, useLendItems, useProfile, useRequestLend } from '@/api/queries';
import { LEND_ART, LEND_MAX_DAYS, clash, dateOf, dayOf, dayStrip, loanDays, quickRange, type QuickPick } from '@/domain/lend';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { dayMonth, shortDate } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Avatar, Button, CategoryArt, Chip, DrawnCheck, ErrorText, Field, Icon, Input, Note, Sheet, Stars } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';

type Step = 'view' | 'ask' | 'sent';
type Pick = QuickPick | 'custom';
const NOTE_MAX = 300;
const PICKS: Pick[] = ['today', 'tomorrow', 'weekend', 'custom'];
const WEEKDAY = ['S', 'M', 'T', 'O', 'T', 'F', 'L'];

const label = (day: string) => shortDate(dateOf(day).toISOString());

/**
 * A thing on Utlån, in one popup (2026-11-13): the photo, what it is, the next 14 days free or taken, the owner,
 * more from the same neighbour – then «Spør om lån» turns the same popup into the ask, and then a «sent» page.
 */
export function LendItemSheet({
  item,
  onClose,
  onOpenItem,
  onSeeRequests,
}: {
  item: LendItem | null;
  onClose: () => void;
  /** another thing from the same owner */
  onOpenItem: (i: LendItem) => void;
  onSeeRequests: () => void;
}) {
  const me = useCurrentUser();
  const [step, setStep] = useState<Step>('view');
  const [shownId, setShownId] = useState<string | null>(null);
  // a new thing always starts on its page
  if (item && item.id !== shownId) {
    setShownId(item.id);
    setStep('view');
  }
  const owner = useProfile(item?.ownerId ?? '').data;
  const first = (owner?.displayName ?? '').split(' ')[0];
  const mine = !!item && item.ownerId === me.id;

  const close = () => {
    setStep('view');
    onClose();
  };

  return (
    <Sheet
      visible={!!item}
      onClose={close}
      scroll
      heightRatio={0.9}
      title={step === 'ask' && item ? nb.lend.askTitle(item.title) : undefined}
      subtitle={step === 'ask' ? nb.lend.askSub(first) : undefined}
      footer={
        item && step === 'view' && !mine ? (
          <Button label={nb.lend.ask} icon="cal" size="lg" onPress={() => setStep('ask')} />
        ) : undefined
      }
    >
      {item && step === 'view' ? <ViewStep item={item} mine={mine} youth={me.isYouth} onOpenItem={onOpenItem} onClose={close} /> : null}
      {item && step === 'ask' ? <AskStep item={item} ownerFirst={first} onBack={() => setStep('view')} onSent={() => setStep('sent')} /> : null}
      {item && step === 'sent' ? (
        <View style={styles.sent}>
          <DrawnCheck size={110} bg={colors.lime} />
          <Text style={[text.h2, styles.center]}>{nb.lend.sentTitle}</Text>
          <Text style={[text.body, styles.center, styles.ink2]}>{nb.lend.sentBody(first)}</Text>
          <Button label={nb.lend.sentSee} icon="arrow" variant="ink" onPress={() => { close(); onSeeRequests(); }} />
          <Button label={nb.lend.sentDone} variant="ghost" onPress={close} />
        </View>
      ) : null}
    </Sheet>
  );
}

function ViewStep({ item, mine, youth, onOpenItem, onClose }: { item: LendItem; mine: boolean; youth: boolean; onOpenItem: (i: LendItem) => void; onClose: () => void }) {
  const t = nb.lend;
  const owner = useProfile(item.ownerId).data;
  const busyData = useLendBusyDays(item.id).data;
  const busy = useMemo(() => busyData ?? [], [busyData]);
  const more = (useLendItems({ ownerId: item.ownerId }).data ?? []).filter((i) => i.active && i.id !== item.id);
  const [today] = useState(() => new Date());
  const strip = useMemo(() => dayStrip(busy, today), [busy, today]);
  const free = strip.filter((d) => !d.busy).length;
  const first = (owner?.displayName ?? '').split(' ')[0];
  const place = owner?.location.place && owner.location.place !== owner.location.municipality ? `${owner.location.place}, ${owner.location.municipality}` : owner?.location.municipality;

  return (
    <View style={styles.gap16}>
      <View style={styles.photo}>
        <CategoryArt category={LEND_ART[item.category]} uri={item.imageUrl} width="100%" height={220} radius={24} iconSize={64} />
        <View style={styles.photoKind}>
          <Icon name={LEND_ART[item.category]} size={13} color={colors.ink} />
          <Text style={styles.photoKindText}>{t.cats[item.category]}</Text>
        </View>
      </View>

      <View style={styles.gap6}>
        <Text style={text.h2} accessibilityRole="header">
          {item.title}
        </Text>
        {item.note ? <Text style={[text.body, styles.ink2]}>{item.note}</Text> : null}
      </View>

      {/* the next 14 days: free or taken */}
      <View style={[styles.box, styles.gap10]} accessible accessibilityLabel={t.availabilityA11y(free)}>
        <View style={styles.between}>
          <Text style={styles.boxTitle}>{t.availability}</Text>
          <View style={styles.legend}>
            <View style={[styles.legendDot, styles.dayFree]} />
            <Text style={styles.legendText}>{t.legendFree}</Text>
            <View style={[styles.legendDot, styles.dayBusy]} />
            <Text style={styles.legendText}>{t.legendBusy}</Text>
          </View>
        </View>
        <View style={styles.strip}>
          {strip.map((d) => {
            const date = dateOf(d.day);
            return (
              <View key={d.day} style={[styles.day, d.busy ? styles.dayBusy : styles.dayFree]}>
                <Text style={[styles.dayW, d.busy && styles.dayTextBusy]}>{WEEKDAY[date.getDay()]}</Text>
                <Text style={[styles.dayN, d.busy && styles.dayTextBusy]}>{date.getDate()}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* who lends it out */}
      <View style={[styles.box, styles.ownerRow]}>
        <Avatar initials={owner?.initials ?? '·'} uri={owner?.avatarUrl} seed={item.ownerId} size={48} />
        <View style={styles.flex}>
          <Text style={styles.ownerLabel}>{t.ownerOf(first)}</Text>
          <Text style={text.label} numberOfLines={1}>
            {owner?.displayName ?? ''}
          </Text>
          <View style={styles.ownerMeta}>
            {owner?.rating?.count ? <Stars rating={owner.rating.average} count={owner.rating.count} /> : null}
            {place ? (
              <View style={styles.placeRow}>
                <Icon name="pin" size={12} color={colors.mute} />
                <Text style={text.meta}>{place}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {!mine ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              onClose();
              safePush(`/profil/${item.ownerId}`);
            }}
            hitSlop={8}
            style={styles.link}
          >
            <Text style={text.link}>{t.seeProfile}</Text>
          </Pressable>
        ) : null}
      </View>

      {more.length ? (
        <View style={styles.gap10}>
          <Text style={styles.boxTitle}>{t.moreFrom(first)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moreRow}>
            {more.map((m) => (
              <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={m.title} onPress={() => onOpenItem(m)} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
                <CategoryArt category={LEND_ART[m.category]} uri={m.imageUrl} width={104} height={84} radius={16} iconSize={26} />
                <Text style={styles.moreTitle} numberOfLines={2}>
                  {m.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {mine ? <Note icon="info">{t.ownItem}</Note> : null}
      <Note icon="shield">{t.payNote}</Note>
    </View>
  );
}

function AskStep({ item, ownerFirst, onBack, onSent }: { item: LendItem; ownerFirst: string; onBack: () => void; onSent: () => void }) {
  const t = nb.lend;
  const ask = useRequestLend();
  const busy = useLendBusyDays(item.id).data ?? [];
  const [today] = useState(() => new Date());
  const [pick, setPick] = useState<Pick | null>(null);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const range = pick && pick !== 'custom' ? quickRange(pick, today) : from && to ? { from: dayOf(from), to: dayOf(to) } : null;
  const order = range && range.to < range.from;
  const days = range && !order ? loanDays(range.from, range.to) : 0;
  const taken = range && !order ? clash(busy, range.from, range.to) : null;
  const tooLong = days > LEND_MAX_DAYS;
  const error = !range ? t.pickDays : order ? t.dateErr : tooLong ? t.tooLong : taken ? t.takenThen(dayMonth(dateOf(taken.fromDate).toISOString()), dayMonth(dateOf(taken.toDate).toISOString())) : null;

  const send = () => {
    if (error || !range) {
      setTried(true);
      haptics.warning();
      return;
    }
    ask.mutate(
      { itemId: item.id, from: range.from, to: range.to, note: note.trim() || undefined },
      {
        onSuccess: () => {
          haptics.success();
          onSent();
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
  };

  return (
    <View style={styles.gap16}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={styles.backRow}>
        <Icon name="back" size={16} color={colors.cyanDeep} />
        <Text style={text.link}>{item.title}</Text>
      </Pressable>

      <Text style={text.label}>{t.when}</Text>
      <View style={styles.picks} accessibilityRole="radiogroup">
        {PICKS.map((p) => (
          <Chip key={p} label={t.pick[p]} icon={p === 'custom' ? 'cal' : undefined} selected={pick === p} onPress={() => setPick(p)} />
        ))}
      </View>
      {pick === 'custom' ? (
        <View style={styles.gap10}>
          <DateField label={t.from} value={from} onChange={setFrom} minToday />
          <DateField label={t.to} value={to} onChange={setTo} minToday />
        </View>
      ) : null}

      {range && !error ? (
        <View style={styles.summary} accessibilityLiveRegion="polite">
          <View style={styles.summaryIc}>
            <Icon name="cal" size={18} color={colors.ink} />
          </View>
          <Text style={styles.summaryText}>{t.summary(label(range.from), label(range.to), days)}</Text>
        </View>
      ) : null}
      {(tried || (range && error)) && error ? <ErrorText>{error}</ErrorText> : null}

      <Field label={t.note} hint={`${note.length}/${NOTE_MAX}`}>
        <Input value={note} onChangeText={setNote} placeholder={t.notePh} maxLength={NOTE_MAX} multiline accessibilityLabel={t.note} />
      </Field>
      <Note icon="shield">{t.payNote}</Note>
      <Button label={t.send} icon="send" size="lg" loading={ask.isPending} onPress={send} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  gap6: { gap: 6 },
  gap10: { gap: 10 },
  gap16: { gap: 16, paddingBottom: 8 },
  center: { textAlign: 'center' },
  ink2: { color: colors.ink2 },
  pressed: { opacity: 0.75 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  photo: { borderRadius: 24, overflow: 'hidden' },
  photoKind: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    transform: [{ rotate: '-4deg' }],
  },
  photoKindText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  box: { padding: 14, borderRadius: radius.card, backgroundColor: colors.surface2 },
  boxTitle: { ...text.eyebrow, fontSize: 11 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { ...text.meta, fontSize: 11.5, marginRight: 4 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  day: { width: 38, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayFree: { backgroundColor: colors.limeTint },
  dayBusy: { backgroundColor: colors.ink },
  dayW: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.limeDeep },
  dayN: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  dayTextBusy: { color: colors.white },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerLabel: { ...text.meta, fontSize: 12 },
  ownerMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  link: { minHeight: 44, justifyContent: 'center' },
  moreRow: { gap: 10, paddingRight: 8 },
  more: { width: 104, gap: 6 },
  moreTitle: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.card, backgroundColor: colors.limeTint },
  summaryIc: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  sent: { alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 8 },
});
