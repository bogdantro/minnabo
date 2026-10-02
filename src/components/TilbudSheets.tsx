import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import { colors, radius, shadow, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  Checkbox,
  Chip,
  Confetti,
  DrawnCheck,
  ErrorText,
  FadeUp,
  Field,
  Icon,
  IconButton,
  Input,
  KeyValueRow,
  Note,
  PaymentNote,
  ScaleIn,
  Sheet,
  Shake,
} from '@/components/ui';

export type AgreementSummary = {
  task: string;
  helper: string;
  price: string;
  when?: string;
  duration?: string;
  place?: string;
  caveats?: string;
};

/* ---------- Godta ---------- */

export function GodtaSheet({
  visible,
  onClose,
  first,
  summary,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  first: string;
  summary: AgreementSummary;
  onConfirm: () => Promise<boolean>;
}) {
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState(0);
  const [busy, setBusy] = useState(false);

  const rows: [string, string | undefined][] = [
    [nb.tilbudDetalj.kvTask, summary.task],
    [nb.tilbudDetalj.kvHelper, summary.helper],
    [nb.tilbudDetalj.kvPrice, summary.price],
    [nb.tilbudDetalj.kvWhen, summary.when],
    [nb.tilbudDetalj.kvDuration, summary.duration],
    [nb.tilbudDetalj.kvPlace, summary.place],
    [nb.tilbudDetalj.kvCaveats, summary.caveats],
  ];
  const shown = rows.filter((r): r is [string, string] => !!r[1]);

  const confirm = async () => {
    if (busy) return;
    if (!ack) {
      setErr((n) => n + 1);
      return;
    }
    setBusy(true);
    const ok = await onConfirm();
    setBusy(false);
    if (ok) setAck(false);
  };

  return (
    <Sheet visible={visible} onClose={() => !busy && onClose()} scroll dismissible={!busy}>
      <View style={styles.head}>
        <View style={styles.headTitles}>
          <View style={styles.lockchip}>
            <Icon name="lock" size={14} color={colors.white} />
            <Text style={styles.lockText}>{nb.tilbudDetalj.lock}</Text>
          </View>
          <Text style={text.h2} accessibilityRole="header">
            {nb.tilbudDetalj.acceptTitle}
          </Text>
        </View>
        <IconButton icon="x" iconSize={18} accessibilityLabel={nb.tilbudDetalj.close} onPress={() => !busy && onClose()} />
      </View>
      <View style={styles.kvCard}>
        {shown.map(([k, v], i) => (
          <KeyValueRow key={k} label={k} value={v} last={i === shown.length - 1} />
        ))}
      </View>
      <Note style={styles.mt12}>{nb.tilbudDetalj.changesNote}</Note>
      <Shake shakeKey={err} style={styles.mt16}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ack }}
          onPress={() => setAck((a) => !a)}
          style={[styles.ackrow, ack && styles.ackOn, err > 0 && !ack && styles.ackErr]}
        >
          <Checkbox checked={ack} />
          <Text style={styles.ackText}>{nb.tilbudDetalj.ack(first)}</Text>
        </Pressable>
      </Shake>
      {err > 0 && !ack ? (
        <View style={styles.mt8}>
          <ErrorText>{nb.tilbudDetalj.ackErr}</ErrorText>
        </View>
      ) : null}
      <PaymentNote style={styles.mt12} />
      <Button
        label={nb.tilbudDetalj.confirm}
        icon="check"
        size="lg"
        onPress={confirm}
        loading={busy}
        loadingLabel={nb.tilbudDetalj.confirming}
        style={[styles.mt16, !ack && styles.dim]}
        accessibilityLabel={nb.tilbudDetalj.confirm}
      />
    </Sheet>
  );
}

/* ---------- Avslå ---------- */

export function AvslaSheet({
  visible,
  onClose,
  first,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  first: string;
  onConfirm: (reasons: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (r: string) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.tilbudDetalj.declineTitle(first)} titleSize="h2">
      <Text style={[text.body, styles.muted]}>{nb.tilbudDetalj.declineSub(first)}</Text>
      <View style={styles.labelRow}>
        <Text style={text.label}>{nb.tilbudDetalj.reason}</Text>
        <Text style={text.hint}>{nb.tilbudDetalj.optional}</Text>
      </View>
      <View style={styles.wrapRow}>
        {nb.tilbudDetalj.reasons.map((r) => (
          <Chip key={r} label={r} size="sm" selected={picked.includes(r)} onPress={() => toggle(r)} />
        ))}
      </View>
      <View style={styles.actions}>
        <Button label={nb.tilbudDetalj.cancel} variant="ghost" block={false} onPress={onClose} style={styles.grow1} />
        <Button
          label={nb.tilbudDetalj.declineConfirm}
          variant="danger"
          block={false}
          onPress={() => {
            onConfirm(picked);
            setPicked([]);
          }}
          style={styles.grow14}
        />
      </View>
    </Sheet>
  );
}

/* ---------- Be om endring ---------- */

export function EndringSheet({
  visible,
  onClose,
  first,
  onSend,
  sending,
}: {
  visible: boolean;
  onClose: () => void;
  first: string;
  onSend: (concerns: string[], message: string) => void;
  sending: boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(0);
  const toggle = (r: string) => {
    setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
    setErr(0);
  };
  const send = () => {
    if (!picked.length) {
      setErr((n) => n + 1);
      return;
    }
    onSend(picked, msg.trim());
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.tilbudDetalj.requestChange} titleSize="h2" scroll>
      <Text style={[text.body, styles.muted]}>{nb.tilbudDetalj.changeSub(first)}</Text>
      <View style={styles.labelRow}>
        <Text style={text.label}>{nb.tilbudDetalj.concerns}</Text>
        <Text style={text.hint}>{nb.tilbudDetalj.pickOne}</Text>
      </View>
      <Shake shakeKey={err}>
        <View style={styles.wrapRow}>
          {nb.tilbudDetalj.changeChips.map((c) => (
            <Chip key={c.label} label={c.label} icon={c.icon} size="sm" selected={picked.includes(c.label)} onPress={() => toggle(c.label)} />
          ))}
        </View>
      </Shake>
      {err > 0 ? (
        <View style={styles.mt10}>
          <ErrorText>{nb.tilbudDetalj.changeErr}</ErrorText>
        </View>
      ) : null}
      <Field label={nb.tilbudDetalj.changeMsg(first)} hint={`${msg.length}/300`} style={styles.mt18}>
        <Input
          value={msg}
          onChangeText={(v) => setMsg(v.slice(0, 300))}
          multiline
          placeholder={nb.tilbudDetalj.changePh}
          accessibilityLabel={nb.tilbudDetalj.changeMsg(first)}
          style={styles.textarea}
        />
      </Field>
      <Button label={nb.tilbudDetalj.changeSend} icon="send" variant="ink" size="lg" onPress={send} loading={sending} style={styles.mt18} />
    </Sheet>
  );
}

/* ---------- Avtale inngått ---------- */

export function AcceptedOverlay({
  first,
  meInitials,
  meAvatar,
  them,
  summary,
  onClose,
  onAgreement,
  onChat,
}: {
  first: string;
  meInitials: string;
  meAvatar?: string;
  them: { initials: string; avatarUrl?: string; id: string };
  summary: AgreementSummary;
  onClose: () => void;
  onAgreement: () => void;
  onChat: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.success} accessibilityViewIsModal accessibilityLabel={nb.tilbudDetalj.successTitle(first)}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Confetti count={26} />
      </View>
      <View style={[styles.successTop, { paddingTop: insets.top + 12 }]}>
        <IconButton icon="x" iconSize={18} accessibilityLabel={nb.tilbudDetalj.close} onPress={onClose} />
      </View>
      <View style={styles.successBody}>
        <ScaleIn>
          <View>
            <DrawnCheck size={128} bg={colors.lime} tickColor={colors.ink} ring={shadow.okRing} tickSize={64} />
            <ScaleIn delay={300} style={styles.hbadge}>
              <Icon name="hand" size={22} color={colors.lime} />
            </ScaleIn>
          </View>
        </ScaleIn>
        <FadeUp delay={200}>
          <Text style={[text.h1, styles.center, styles.mt28]} accessibilityRole="header">
            {nb.tilbudDetalj.successTitle(first)}
          </Text>
        </FadeUp>
        <FadeUp delay={250}>
          <Text style={[text.body, styles.center, styles.successSub]}>{nb.tilbudDetalj.successSub}</Text>
        </FadeUp>
        <FadeUp delay={300} style={styles.stretch}>
          <View style={[styles.sumCard, shadow.card]}>
            <View style={styles.avpair}>
              <Avatar initials={meInitials} uri={meAvatar} me size={40} ring={false} />
              <View style={styles.avOverlap}>
                <Avatar initials={them.initials} uri={them.avatarUrl} seed={them.id} size={40} ring={false} />
              </View>
            </View>
            <View style={styles.flex}>
              <Text style={[text.label, styles.f145]} numberOfLines={1}>
                {summary.task}
              </Text>
              {summary.when || summary.duration ? (
                <Text style={text.meta} numberOfLines={1}>
                  {[summary.when, summary.duration].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            <Text style={[text.num, styles.f18]}>{summary.price}</Text>
          </View>
        </FadeUp>
        <FadeUp delay={350} style={styles.stretch}>
          <PaymentNote style={styles.mt12} />
        </FadeUp>
      </View>
      <FadeUp delay={400} style={[styles.successActions, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
        <Button label={nb.tilbudDetalj.seeAgreement} iconRight="arrow" size="lg" onPress={onAgreement} />
        <Button label={nb.tilbudDetalj.openChat} icon="msg" variant="ghost" onPress={onChat} />
      </FadeUp>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 3 },
  center: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
  f145: { fontSize: 14.5 },
  f18: { fontSize: 18 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt28: { marginTop: 28 },
  dim: { opacity: 0.5 },
  muted: { color: colors.mute },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  headTitles: { flex: 1, gap: 8 },
  lockchip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  lockText: { fontFamily: text.label.fontFamily, fontSize: 12, color: colors.white },
  kvCard: { borderRadius: radius.card, backgroundColor: colors.footTint, borderWidth: 1, borderColor: colors.line, paddingVertical: 4, paddingHorizontal: 16 },
  ackrow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  ackOn: { borderColor: colors.ink, backgroundColor: colors.footTint },
  ackErr: { borderColor: colors.danger },
  ackText: { flex: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 18, marginBottom: 10 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  grow1: { flexGrow: 1, flexBasis: 'auto' },
  grow14: { flexGrow: 1.4, flexBasis: 'auto' },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  success: { ...StyleSheet.absoluteFill, zIndex: 70, backgroundColor: colors.white, overflow: 'hidden' },
  successTop: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
  successBody: { flex: 1, alignItems: 'center', paddingTop: 20, paddingHorizontal: 26 },
  hbadge: {
    position: 'absolute',
    right: -6,
    bottom: 2,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
  },
  successSub: { color: colors.ink2, marginTop: 10 },
  sumCard: {
    marginTop: 22,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avpair: { flexDirection: 'row' },
  avOverlap: { marginLeft: -10, borderRadius: 22, borderWidth: 2.5, borderColor: colors.white },
  successActions: { paddingHorizontal: 24, gap: 10 },
});
