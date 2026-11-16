/**
 * Panels on an oppslag card for the newer kinds of oppslag and for arrangementer (0108):
 *   - strømbrudd: «Hos meg også» and when it closes; savnet dyr: «Sett den?»; samkjøring: the payment note;
 *   - arrangementer: «Hvem tar med hva», volunteer slots, the photo album, «Legg i kalenderen», and the
 *     things neighbours lend out (for a dugnad).
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { NoticeboardPost } from '@/domain/types';
import { useEventItemActions, useEventItems, useEventPhotoActions, useEventPhotos, useNoticeMetoo, useSetMetoo } from '@/api/communityQueries';
import { useLendItems } from '@/api/queries';
import { addAgreementToCalendar, deviceCalendarSupported } from '@/lib/deviceCalendar';
import { pickAndUpload } from '@/lib/uploads';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Image } from '@/components/ui/Image';
import { Button, Icon, IconButton, Input, Note, PaymentNote, TextLink } from '@/components/ui';

const LABEL_MAX = 60;
const NEED_MAX = 50;

/** Hours left until the oppslag closes by itself, rounded up. */
const hoursLeft = (iso: string, now: number) => Math.max(1, Math.ceil((Date.parse(iso) - now) / 3_600_000));

export function TopicPanel({ post, mine, now, onSeen }: { post: NoticeboardPost; mine: boolean; now: number; onSeen: () => void }) {
  if (!post.topic || post.doneAt) return null;
  const t = nb.felles.topics;
  return (
    <View style={styles.box}>
      {post.expiresAt ? (
        <View style={styles.row}>
          <Icon name="hourglass" size={14} color={colors.mute} />
          <Text style={text.meta}>{t.expiresIn(hoursLeft(post.expiresAt, now))}</Text>
        </View>
      ) : null}
      {post.topic === 'OUTAGE' ? <Metoo post={post} /> : null}
      {post.topic === 'PET' ? (
        mine ? (
          <View style={styles.row}>
            <Icon name="bell" size={14} color={colors.danger} />
            <Text style={[text.meta, styles.danger]}>{t.petAlert}</Text>
          </View>
        ) : (
          <Button label={t.seenIt} variant="danger" size="sm" block={false} icon="eye" onPress={onSeen} />
        )
      ) : null}
      {post.topic === 'RIDE' ? <PaymentNote /> : null}
      {post.topic === 'RECOMMEND' ? <Text style={text.hint}>{t.hints.RECOMMEND}</Text> : null}
    </View>
  );
}

function Metoo({ post }: { post: NoticeboardPost }) {
  const state = useNoticeMetoo(post.id).data;
  const set = useSetMetoo(post.id);
  const on = !!state?.mine;
  const n = state?.count ?? 0;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={nb.felles.topics.metooA11y(n)}
        onPress={() => {
          haptics.light();
          set.mutate(!on, { onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)) });
        }}
        style={[styles.metoo, on && styles.metooOn]}
      >
        <Icon name={on ? 'check' : 'zap'} size={15} color={on ? colors.white : colors.warn} />
        <Text style={[styles.metooText, on && styles.white]}>{on ? nb.felles.topics.metooOn : nb.felles.topics.metoo}</Text>
      </Pressable>
      {n ? <Text style={[text.meta, styles.flex]}>{nb.felles.topics.metooCount(n)}</Text> : null}
    </View>
  );
}

// ------------------------------------------------------------
// Arrangementer
// ------------------------------------------------------------
export function EventExtras({ post, mine, meId, youth, now }: { post: NoticeboardPost; mine: boolean; meId: string; youth: boolean; now: number }) {
  const started = !!post.eventAt && Date.parse(post.eventAt) <= now;
  return (
    <View style={styles.extras}>
      {post.repeatWeekly ? (
        <View style={styles.row}>
          <Icon name="repeat" size={14} color={colors.limeDeep} />
          <Text style={text.meta}>{nb.felles.event.weekly}</Text>
        </View>
      ) : null}
      <BringList post={post} mine={mine} meId={meId} />
      {post.eventType === 'DUGNAD' && !youth ? <DugnadEquipment kommune={post.municipality} /> : null}
      {started ? <Album post={post} meId={meId} mine={mine} /> : null}
      {!started && post.eventAt && deviceCalendarSupported ? (
        <TextLink
          label={nb.felles.event.calendar}
          icon="cal"
          onPress={async () => {
            const r = await addAgreementToCalendar({ title: post.title, start: new Date(post.eventAt!), hours: 2, location: post.place, notes: post.body });
            if (r.ok) toast.success(nb.felles.event.calendarDone);
            else if (r.reason !== 'unsupported') toast.error(nb.toast.genericError);
          }}
        />
      ) : null}
    </View>
  );
}

function BringList({ post, mine, meId }: { post: NoticeboardPost; mine: boolean; meId: string }) {
  const items = useEventItems(post.id).data ?? [];
  const act = useEventItemActions(post.id);
  const [label, setLabel] = useState('');
  const [needed, setNeeded] = useState('');
  // the «Hvem tar med hva» field has its own text, apart from the organiser's slot field
  const [bringLabel, setBringLabel] = useState('');
  const bring = items.filter((i) => i.needed === null);
  const slots = items.filter((i) => i.needed !== null);
  const over = !!post.doneAt;
  const onErr = (e: unknown) => toast.error(serverMessage(e, nb.toast.genericError));
  const add = (asSlot: boolean) => {
    const n = Number(needed);
    act.add.mutate(
      { label: asSlot ? label : bringLabel, needed: asSlot ? Math.min(NEED_MAX, Math.max(1, Number.isFinite(n) && n > 0 ? n : 1)) : undefined },
      {
        onSuccess: () => {
          if (asSlot) {
            setLabel('');
            setNeeded('');
          } else setBringLabel('');
        },
        onError: onErr,
      },
    );
  };
  const t = nb.felles.event;
  return (
    <>
      {slots.length || mine ? (
        <View style={styles.list}>
          <Text style={styles.listTitle}>{t.slotsTitle}</Text>
          <Text style={text.hint}>{t.slotsSub}</Text>
          {slots.map((s) => {
            const taken = s.takers.length;
            const me = s.takers.some((x) => x.id === meId);
            const full = taken >= (s.needed ?? 1);
            return (
              <View key={s.id} style={styles.item}>
                <View style={styles.flex}>
                  <Text style={styles.itemLabel}>{s.label}</Text>
                  <Text style={text.hint}>{`${t.slotCount(taken, s.needed ?? 1)}${s.takers.length ? ` · ${s.takers.map((x) => x.name).join(', ')}` : ''}`}</Text>
                </View>
                {over ? null : me ? (
                  <Button label={t.slotLeave} variant="text" size="sm" block={false} onPress={() => act.take.mutate({ itemId: s.id, take: false }, { onError: onErr })} />
                ) : full ? (
                  <Text style={styles.full}>{t.slotFull}</Text>
                ) : (
                  <Button label={t.slotJoin} variant="lime" size="sm" block={false} onPress={() => act.take.mutate({ itemId: s.id, take: true }, { onError: onErr })} />
                )}
                {mine ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t.removeA11y(s.label)} onPress={() => act.remove.mutate(s.id)} hitSlop={8} style={styles.x}>
                    <Icon name="x" size={14} color={colors.mute} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {mine && !over ? (
            <View style={styles.addRow}>
              <Input value={label} onChangeText={setLabel} maxLength={LABEL_MAX} placeholder={t.slotPh} accessibilityLabel={t.slotAdd} containerStyle={styles.flex} />
              <Input value={needed} onChangeText={(v) => setNeeded(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} placeholder="3" accessibilityLabel={t.slotNeeded} containerStyle={styles.need} />
              <IconButton icon="plus" variant="dark" accessibilityLabel={t.slotAdd} disabled={!label.trim()} onPress={() => add(true)} />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.list}>
        <Text style={styles.listTitle}>{t.bringTitle}</Text>
        {bring.length === 0 ? <Text style={text.hint}>{t.bringEmpty}</Text> : null}
        {bring.map((b) => {
          const taker = b.takers[0];
          const me = taker?.id === meId;
          return (
            <View key={b.id} style={styles.item}>
              <Icon name={taker ? 'check' : 'gift'} size={15} color={taker ? colors.okText : colors.mute} />
              <View style={styles.flex}>
                <Text style={styles.itemLabel}>{b.label}</Text>
                {taker ? <Text style={text.hint}>{me ? t.bringMine : t.bringTaken(taker.name)}</Text> : null}
              </View>
              {over ? null : me ? (
                <Button label={t.bringUndo} variant="text" size="sm" block={false} onPress={() => act.take.mutate({ itemId: b.id, take: false }, { onError: onErr })} />
              ) : !taker ? (
                <Button label={t.bringTake} variant="ghost" size="sm" block={false} onPress={() => act.take.mutate({ itemId: b.id, take: true }, { onError: onErr })} />
              ) : null}
              {mine || b.createdBy === meId ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t.removeA11y(b.label)} onPress={() => act.remove.mutate(b.id)} hitSlop={8} style={styles.x}>
                  <Icon name="x" size={14} color={colors.mute} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {!over ? (
          <View style={styles.addRow}>
            <Input value={bringLabel} onChangeText={setBringLabel} maxLength={LABEL_MAX} placeholder={t.bringPh} accessibilityLabel={t.bringAdd} containerStyle={styles.flex} />
            <IconButton icon="plus" variant="dark" accessibilityLabel={t.bringAdd} disabled={!bringLabel.trim()} onPress={() => add(false)} />
          </View>
        ) : null}
      </View>
    </>
  );
}

function DugnadEquipment({ kommune }: { kommune: string }) {
  const items = (useLendItems({ municipality: kommune }).data ?? []).filter((i) => i.category === 'HAGE' || i.category === 'VERKTOY').slice(0, 8);
  if (!items.length) return null;
  return (
    <View style={styles.list}>
      <Text style={styles.listTitle}>{nb.felles.event.equipTitle}</Text>
      <Text style={text.hint}>{nb.felles.event.equipSub}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.equipRow}>
        {items.map((i) => (
          <Pressable key={i.id} accessibilityRole="link" onPress={() => safePush(i.noticeId ? `/oppslagstavle?oppslag=${i.noticeId}` : '/utlan')} style={styles.equip}>
            <Icon name={i.category === 'HAGE' ? 'hage' : 'montering'} size={15} color={colors.lavender} />
            <Text style={styles.equipText} numberOfLines={1}>
              {i.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Album({ post, meId, mine }: { post: NoticeboardPost; meId: string; mine: boolean }) {
  const photos = useEventPhotos(post.id).data ?? [];
  const act = useEventPhotoActions(post.id);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!meId || busy) return;
    setBusy(true);
    try {
      const r = await pickAndUpload({ bucket: 'listing-images', folder: meId, source: 'library' });
      if (r) await act.add.mutateAsync(r.path);
    } catch (e) {
      toast.error(serverMessage(e, nb.felles.event.albumLater));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.list}>
      <Text style={styles.listTitle}>{nb.felles.event.albumTitle}</Text>
      <Text style={text.hint}>{nb.felles.event.albumSub}</Text>
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.equipRow}>
          {photos.map((p) => (
            <View key={p.id} style={styles.thumb}>
              <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
              {p.profileId === meId || mine ? (
                <Pressable accessibilityRole="button" accessibilityLabel={nb.felles.event.remove} onPress={() => act.remove.mutate(p.id)} style={styles.thumbX}>
                  <Icon name="x" size={12} color={colors.white} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : (
        <Note icon="image">{nb.felles.event.albumEmpty}</Note>
      )}
      <Button label={nb.felles.event.albumAdd} variant="ghost" size="sm" block={false} icon="camera" loading={busy} onPress={add} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { color: colors.white },
  danger: { color: colors.danger },
  box: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metoo: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.warnTint },
  metooOn: { backgroundColor: colors.warn },
  metooText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.warn },
  extras: { gap: 10 },
  list: { gap: 6, padding: 12, borderRadius: radius.tile, backgroundColor: colors.surface2 },
  listTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  itemLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  full: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.mute },
  x: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  need: { width: 64 },
  equipRow: { gap: 8 },
  equip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.lavenderTint, maxWidth: 200 },
  equipText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.lavender },
  thumb: { width: 92, height: 92, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface },
  thumbX: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
});
