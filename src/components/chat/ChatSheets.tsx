import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicProfile } from '@/domain/types';
import nb from '@/i18n/nb';
import { shortDate } from '@/lib/datetime';
import { toast } from '@/lib/toast';
import { colors, radius, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  Chip,
  FadeUp,
  Field,
  Icon,
  Input,
  ListGroup,
  ListRow,
  ScaleIn,
  Sheet,
  Toggle,
  type IconKey,
} from '@/components/ui';

/* ---------- Del i samtalen ---------- */

export function ShareSheet({
  visible,
  onClose,
  busy,
  canOffer,
  canPlace,
  onImage,
  onCamera,
  onTime,
  onPlace,
  onOffer,
}: {
  visible: boolean;
  onClose: () => void;
  busy: boolean;
  canOffer: boolean;
  canPlace: boolean;
  onImage: () => void;
  onCamera: () => void;
  onTime: () => void;
  onPlace: () => void;
  onOffer: () => void;
}) {
  // "Del sted" is always there, but locked until a tilbud is accepted (rule: no exact address before an avtale)
  const lockedPlace = () => toast.info(nb.chat.placeLocked, { icon: 'lock', bottom: 150 });
  const tiles: { key: string; label: string; icon: IconKey; bg: string; fg: string; onPress: () => void; locked?: boolean }[] = [
    { key: 'img', label: nb.chat.tileImage, icon: 'image', bg: colors.cyanTint, fg: colors.cyanDeep, onPress: onImage },
    { key: 'cam', label: nb.chat.tileCamera, icon: 'camera', bg: colors.limeTint, fg: colors.limeDeep, onPress: onCamera },
    { key: 'time', label: nb.chat.tileTime, icon: 'cal', bg: colors.ink, fg: colors.lime, onPress: onTime },
    canPlace
      ? { key: 'place', label: nb.chat.tilePlace, icon: 'pin', bg: colors.warnTint, fg: colors.warn, onPress: onPlace }
      : { key: 'place', label: nb.chat.tilePlace, icon: 'lock', bg: colors.neutralPill, fg: colors.mute, onPress: lockedPlace, locked: true },
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.chat.shareTitle} titleSize="h2">
      <View style={styles.atiles}>
        {tiles.map((t, i) => (
          <FadeUp key={t.key} delay={(i + 1) * 50} style={styles.atileWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.locked ? nb.chat.placeLockedA11y : t.label}
              disabled={busy}
              onPress={t.onPress}
              style={({ pressed }) => [styles.atile, pressed && styles.pressed, (busy || t.locked) && styles.dim]}
            >
              <View style={[styles.icirc, { backgroundColor: t.bg }]}>
                <Icon name={t.icon} size={22} color={t.fg} />
              </View>
              <Text style={styles.atileText}>{t.label}</Text>
            </Pressable>
          </FadeUp>
        ))}
      </View>
      <FadeUp delay={250}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canOffer }}
          disabled={!canOffer}
          onPress={onOffer}
          style={[styles.adis, canOffer && styles.aEnabled]}
        >
          <View style={[styles.icircSm, { backgroundColor: canOffer ? colors.limeTint : colors.neutralPill }]}>
            <Icon name="tag" size={18} color={canOffer ? colors.limeDeep : colors.mute} />
          </View>
          <View style={styles.flex}>
            <Text style={[text.label, styles.f15]}>{nb.chat.sendOfferRow}</Text>
            <Text style={styles.adisSub}>{canOffer ? nb.chat.sendOfferSub : nb.chat.sendOfferLocked}</Text>
          </View>
          <Icon name={canOffer ? 'right' : 'lock'} size={18} color={colors.faint} />
        </Pressable>
      </FadeUp>
    </Sheet>
  );
}

/* ---------- Foreslå tid ---------- */

const SLOTS = ['08:00', '09:00', '10:00', '12:00', '14:00', '16:00'];

export function TimeSheet({
  visible,
  onClose,
  first,
  onSend,
  title,
  subtitle,
  cta,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  first: string;
  /** `when` = "lør 12. okt kl. 10:00", `iso` = the same moment as a timestamp */
  onSend: (when: string, iso: string) => void;
  /** other wording when the sheet is used on an avtale */
  title?: string;
  subtitle?: string;
  cta?: string;
  busy?: boolean;
}) {
  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1);
      const [dow, ...rest] = shortDate(d.toISOString()).split(' ');
      return { key: `${dow} ${rest.join(' ')}`, dow, date: rest.join(' '), at: d };
    });
  }, []);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const ready = !!day && !!slot;
  const send = () => {
    if (!ready) return;
    const at = new Date(days.find((d) => d.key === day)?.at ?? Date.now());
    const [h, m] = (slot ?? '00:00').split(':').map(Number);
    at.setHours(h, m, 0, 0);
    onSend(`${day} kl. ${slot}`, at.toISOString());
    setDay(null);
    setSlot(null);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? nb.chat.proposeTime} titleSize="h2" subtitle={subtitle ?? nb.chat.timeSheetSub(first)}>
      <Text style={[text.label, styles.mb10]}>{nb.chat.day}</Text>
      <View style={styles.dayrow}>
        {days.map((d) => {
          const on = day === d.key;
          return (
            <Pressable
              key={d.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={d.key}
              onPress={() => setDay(d.key)}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text style={[styles.dow, on && styles.onText]}>{d.dow}</Text>
              <Text style={[styles.dayDate, on && styles.onText]}>{d.date}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[text.label, styles.mt20, styles.mb10]}>{nb.chat.clock}</Text>
      <View style={styles.tslots}>
        {SLOTS.map((s) => (
          <Chip key={s} label={`kl. ${s}`} size="sm" selected={slot === s} onPress={() => setSlot(s)} style={styles.slot} />
        ))}
      </View>
      {ready ? (
        <FadeUp style={styles.tprev}>
          <View style={styles.tprevIc}>
            <Icon name="cal" size={18} color={colors.cyanDeep} />
          </View>
          <View>
            <Text style={[text.meta, { color: colors.cyanDeep }]}>{nb.chat.yourSuggestion}</Text>
            <Text style={styles.tprevB}>{`${day} · kl. ${slot}`}</Text>
          </View>
        </FadeUp>
      ) : null}
      <Button label={cta ?? nb.chat.sendTime} icon="send" size="lg" disabled={!ready} loading={busy} onPress={send} style={styles.mt18} />
    </Sheet>
  );
}

/* ---------- Del sted (after an agreement) ---------- */

function mapsUrl(q: string): string {
  const e = encodeURIComponent(q);
  return Platform.OS === 'ios' ? `https://maps.apple.com/?q=${e}` : `https://www.google.com/maps/search/?api=1&query=${e}`;
}

export function PlaceSheet({
  visible,
  onClose,
  defaultPlace,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  defaultPlace?: string;
  onSend: (textValue: string) => void;
}) {
  const [place, setPlace] = useState(defaultPlace ?? '');
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.chat.sharePlace} titleSize="h2" subtitle={nb.chat.sharePlaceHint}>
      <Field label={nb.chat.meetingPoint}>
        <Input value={place} onChangeText={setPlace} placeholder="F.eks. Storgata 1, Lillehammer" accessibilityLabel={nb.chat.meetingPoint} />
      </Field>
      <Button
        label={nb.chat.sendSuggestion}
        icon="send"
        size="lg"
        disabled={!place.trim()}
        onPress={() => {
          const t = place.trim();
          if (!t) return;
          onSend(`📍 ${nb.chat.meetingPoint}: ${t}\n${mapsUrl(t)}`);
        }}
        style={styles.mt18}
      />
    </Sheet>
  );
}

/** Opens a "📍 Møteplass" link in the maps app. */
export function openMapLink(textValue: string): boolean {
  const url = /https?:\/\/\S+/.exec(textValue)?.[0];
  if (!url) return false;
  void Linking.openURL(url);
  return true;
}

/* ---------- menu ---------- */

export function ChatMenuSheet({
  visible,
  onClose,
  profile,
  listingTitle,
  muted,
  blocked,
  onProfile,
  onListing,
  onToggleMute,
  onReport,
  onBlock,
}: {
  visible: boolean;
  onClose: () => void;
  profile: PublicProfile;
  listingTitle: string;
  muted: boolean;
  blocked: boolean;
  onProfile: () => void;
  onListing: () => void;
  onToggleMute: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  const first = profile.displayName.split(' ')[0];
  const place = profile.location.place || profile.location.municipality;
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.mhead}>
        <Avatar initials={profile.initials} uri={profile.avatarUrl} seed={profile.id} size={56} />
        <View style={styles.flex}>
          <Text style={styles.mname} numberOfLines={1}>
            {profile.displayName}
          </Text>
          <View style={styles.mmeta}>
            {profile.rating?.count ? (
              <>
                <Icon name="star" size={14} color={colors.star} filled />
                <Text style={styles.mrating}>{profile.rating.average.toFixed(1).replace('.', ',')}</Text>
                <Text style={text.meta}>{`(${profile.rating.count})`}</Text>
              </>
            ) : null}
            {place ? <Text style={text.meta}>{`${profile.rating?.count ? '· ' : ''}${place}`}</Text> : null}
          </View>
        </View>
      </View>
      <ListGroup>
        <ListRow icon="user" title={nb.chat.seeProfile} subtitle={nb.chat.seeProfileSub} onPress={onProfile} />
        <ListRow icon="clip" title={nb.chat.seeListing} subtitle={listingTitle} onPress={onListing} />
        <ListRow
          icon="bell"
          title={nb.chat.muteTitle}
          subtitle={muted ? nb.chat.muteOn : nb.chat.muteOff}
          onPress={onToggleMute}
          chevron={false}
          right={
            <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
              <Toggle value={muted} onValueChange={onToggleMute} accessibilityLabel={nb.chat.muteTitle} />
            </View>
          }
        />
      </ListGroup>
      <View style={styles.mt12}>
        <ListGroup>
          <ListRow icon="flag" danger title={nb.chat.report} subtitle={nb.chat.reportSub} onPress={onReport} />
          <ListRow
            icon="ban"
            danger
            chevron={false}
            title={blocked ? nb.chat.unblockTitle : nb.chat.block}
            subtitle={blocked ? nb.chat.unblockSub(first) : nb.chat.blockSub(first)}
            onPress={onBlock}
          />
        </ListGroup>
      </View>
    </Sheet>
  );
}

/* ---------- pin (long press) ---------- */

export function PinSheet({ visible, pinned, onClose, onToggle }: { visible: boolean; pinned: boolean; onClose: () => void; onToggle: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.chat.messageActions}>
      <ScaleIn>
        <Button label={pinned ? nb.chat.unpinMessage : nb.chat.pinMessage} icon={pinned ? 'x' : 'pinned'} variant="ghost" onPress={onToggle} />
      </ScaleIn>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 3 },
  dim: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.95 }] },
  f15: { fontSize: 15 },
  mt12: { marginTop: 12 },
  mt18: { marginTop: 18 },
  mt20: { marginTop: 20 },
  mb10: { marginBottom: 10 },
  atiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  atileWrap: { flexBasis: '30%', flexGrow: 1 },
  atile: {
    height: 104,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  icirc: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  icircSm: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  atileText: { fontFamily: text.label.fontFamily, fontSize: 14, color: colors.ink },
  adis: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    backgroundColor: colors.surface2,
    opacity: 0.72,
  },
  aEnabled: { opacity: 1, borderStyle: 'solid', borderColor: colors.line, backgroundColor: colors.white },
  adisSub: { fontFamily: text.body.fontFamily, fontSize: 12.5, lineHeight: 17, color: colors.mute },
  dayrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: {
    width: '22.5%',
    flexGrow: 1,
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dayOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dow: { fontFamily: text.bodySemi.fontFamily, fontSize: 11, opacity: 0.75, color: colors.ink },
  dayDate: { fontFamily: text.label.fontFamily, fontSize: 14, color: colors.ink },
  onText: { color: colors.white, opacity: 1 },
  tslots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '31%', justifyContent: 'center' },
  tprev: { marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: colors.cyanTint, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tprevIc: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tprevB: { fontFamily: text.h3.fontFamily, fontSize: 17, lineHeight: 19, color: colors.ink },
  mhead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  mname: { fontFamily: text.h3.fontFamily, fontSize: 19, lineHeight: 23, color: colors.ink },
  mmeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  mrating: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  sumRadius: { borderRadius: radius.card },
});
