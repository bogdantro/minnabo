import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NoticeboardPost, ToolBooking } from '@/domain/types';
import {
  useDugnadSignups,
  useProfile,
  useRequestToolBooking,
  useRespondToolBooking,
  useSetDugnadSignup,
  useToolBookedDays,
  useToolBookings,
} from '@/api/queries';
import { isoDay } from '@/screens/LeggUt/wizardModel';
import { shortDate, formatTime } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import nb from '@/i18n/nb';
import { colors, radius, text } from '@/theme/theme';
import { Avatar, Button, Field, Icon, Input, Note, Pill, ScaleIn, Sheet } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';

const BOTTOM = 100;
/** Faces on the card; the rest is a number. */
const FACES = 5;
const NOTE_MAX = 200;

const day = (iso: string) => shortDate(`${iso}T12:00:00`);

function Face({ id }: { id: string }) {
  const p = useProfile(id).data;
  return (
    <View style={styles.face}>
      <Avatar initials={p?.initials ?? '·'} uri={p?.avatarUrl} seed={id} size={30} ring={false} />
    </View>
  );
}

/** A dugnad on the card: when, who is coming, and «Jeg blir med». */
export function DugnadPanel({ post, meId, mine }: { post: NoticeboardPost; meId: string; mine: boolean }) {
  const { data } = useDugnadSignups(post.id);
  const set = useSetDugnadSignup(post.id);
  const signups = data ?? [];
  const joined = signups.includes(meId);
  const [now] = useState(() => Date.now());
  const over = !!post.doneAt || (!!post.eventAt && Date.parse(post.eventAt) < now);
  const toggle = () =>
    set.mutate(!joined, {
      onSuccess: () => {
        haptics.success();
        toast.success(joined ? nb.dugnad.left : nb.dugnad.joined, { icon: joined ? 'x' : 'check', bottom: BOTTOM });
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: BOTTOM }),
    });
  return (
    <View style={styles.panel}>
      {post.eventAt ? (
        <View style={styles.line}>
          <Icon name="cal" size={16} color={colors.limeDeep} />
          <Text style={styles.lineText}>{`${shortDate(post.eventAt)} kl. ${formatTime(post.eventAt)}`}</Text>
        </View>
      ) : null}
      <View style={styles.line}>
        {signups.length ? (
          <View style={styles.faces}>
            {signups.slice(0, FACES).map((id) => (
              <Face key={id} id={id} />
            ))}
          </View>
        ) : null}
        <Text style={[text.meta, styles.flex]}>{nb.dugnad.count(signups.length)}</Text>
      </View>
      {!mine && !over ? (
        <Button label={joined ? nb.dugnad.leave : nb.dugnad.join} icon={joined ? 'x' : 'check'} variant={joined ? 'ghost' : 'primary'} size="sm" loading={set.isPending} onPress={toggle} />
      ) : null}
    </View>
  );
}

/** A tool: which days are taken, asking to borrow, and the owner's answers. */
export function ToolLoanPanel({ post, meId, mine }: { post: NoticeboardPost; meId: string; mine: boolean }) {
  const booked = useToolBookedDays(post.id).data ?? [];
  const bookings = useToolBookings(post.id).data ?? [];
  const respond = useRespondToolBooking(post.id);
  const [open, setOpen] = useState(false);
  const myOpen = bookings.find((b) => b.borrowerId === meId && (b.status === 'PENDING' || b.status === 'APPROVED'));
  const answer = (b: ToolBooking, status: 'APPROVED' | 'DECLINED' | 'RETURNED' | 'CANCELLED') =>
    respond.mutate({ id: b.id, status }, { onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: BOTTOM }) });
  const asks = bookings.filter((b) => b.status === 'PENDING' || b.status === 'APPROVED');
  return (
    <View style={styles.panel}>
      {booked.length ? (
        <View style={styles.line}>
          <Icon name="cal" size={16} color={colors.warn} />
          <Text style={[text.meta, styles.flex]}>{nb.tools.taken(booked.map((b) => `${day(b.from)} – ${day(b.to)}`).join(', '))}</Text>
        </View>
      ) : (
        <View style={styles.line}>
          <Icon name="check" size={16} color={colors.ok} />
          <Text style={[text.meta, styles.flex]}>{nb.tools.free}</Text>
        </View>
      )}
      {mine
        ? asks.map((b) => <OwnerRow key={b.id} booking={b} onAnswer={(s) => answer(b, s)} />)
        : null}
      {!mine && myOpen ? (
        <ScaleIn>
          <View style={styles.mine}>
            <Pill label={myOpen.status === 'APPROVED' ? nb.tools.approved : nb.tools.pending} tone={myOpen.status === 'APPROVED' ? 'ok' : 'warn'} size="sm" />
            <Text style={[text.meta, styles.flex]}>{`${day(myOpen.from)} – ${day(myOpen.to)}`}</Text>
            <Button label={nb.tools.cancel} variant="ghost" size="sm" block={false} onPress={() => answer(myOpen, 'CANCELLED')} />
          </View>
        </ScaleIn>
      ) : null}
      {!mine && !myOpen && !post.doneAt ? <Button label={nb.tools.ask} icon="cal" variant="primary" size="sm" onPress={() => setOpen(true)} /> : null}
      <BorrowSheet post={post} visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

function OwnerRow({ booking: b, onAnswer }: { booking: ToolBooking; onAnswer: (s: 'APPROVED' | 'DECLINED' | 'RETURNED') => void }) {
  const who = useProfile(b.borrowerId).data;
  return (
    <View style={styles.ask}>
      <View style={styles.line}>
        <Avatar initials={who?.initials ?? '·'} uri={who?.avatarUrl} seed={b.borrowerId} size={30} ring={false} />
        <View style={styles.flex}>
          <Text style={text.label} numberOfLines={1}>
            {who?.displayName ?? ''}
          </Text>
          <Text style={text.meta}>{`${day(b.from)} – ${day(b.to)}`}</Text>
        </View>
      </View>
      {b.note ? <Text style={text.meta}>{b.note}</Text> : null}
      <View style={styles.btns}>
        {b.status === 'PENDING' ? (
          <>
            <Button label={nb.tools.decline} variant="ghost" size="sm" block={false} onPress={() => onAnswer('DECLINED')} style={styles.grow} />
            <Button label={nb.tools.approve} icon="check" size="sm" block={false} onPress={() => onAnswer('APPROVED')} style={styles.grow} />
          </>
        ) : (
          <Button label={nb.tools.returned} icon="check" variant="ghost" size="sm" onPress={() => onAnswer('RETURNED')} />
        )}
      </View>
    </View>
  );
}

function BorrowSheet({ post, visible, onClose }: { post: NoticeboardPost; visible: boolean; onClose: () => void }) {
  const request = useRequestToolBooking(post.id);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const bad = !from || !to || to < from;
  const send = () => {
    if (!from || !to) return;
    request.mutate(
      { from: isoDay(from), to: isoDay(to), note: note.trim() || undefined },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(nb.tools.sent, { icon: 'check', bottom: BOTTOM });
          setFrom(null);
          setTo(null);
          setNote('');
          onClose();
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: BOTTOM }),
      },
    );
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.tools.ask} subtitle={post.title} scroll>
      <View style={styles.form}>
        <DateField label={nb.tools.from} value={from} onChange={setFrom} minToday />
        <DateField label={nb.tools.to} value={to} onChange={setTo} minToday />
        {from && to && to < from ? <Note icon="alert">{nb.tools.badDates}</Note> : null}
        <Field label={nb.tools.note} hint={`${note.length}/${NOTE_MAX}`}>
          <Input value={note} onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))} placeholder={nb.tools.notePh} multiline accessibilityLabel={nb.tools.note} />
        </Field>
        <Button label={nb.tools.send} icon="send" variant="ink" loading={request.isPending} disabled={bad} onPress={send} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, flexBasis: 0 },
  panel: { gap: 10, padding: 12, borderRadius: radius.m, backgroundColor: colors.surface2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { fontFamily: text.label.fontFamily, fontSize: 14, color: colors.ink },
  faces: { flexDirection: 'row' },
  face: { marginRight: -8, borderRadius: 16, borderWidth: 2, borderColor: colors.surface2 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ask: { gap: 8, padding: 10, borderRadius: radius.m, backgroundColor: colors.surface },
  btns: { flexDirection: 'row', gap: 8 },
  form: { gap: 14 },
});
