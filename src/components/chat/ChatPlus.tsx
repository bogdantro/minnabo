/**
 * Chat additions (0109): video and PDF bubbles, a shared oppdrag as a card, editing, «Send senere», the shared
 * address, picking an oppdrag to share, «Om samtalen», «Angre» on a sent message, the safety and youth notes,
 * «Spør igjen» and «Borte til …».
 */
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { Conversation, Listing, Message } from '@/domain/types';
import type { ScheduledMessage, SharedAddress } from '@/domain/inbox';
import { useListing, useListings } from '@/api/queries';
import { formatTime, shortDate } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Button, Field, Icon, Input, ListGroup, ListRow, Note, Sheet, type IconName } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';
import { TimeField } from '@/components/ui/TimeField';
import { CategoryArt } from '@/components/ui/CategoryArt';
import { categoryArtId } from '@/domain/categories';
import { SITE } from '@/config/links';

// ------------------------------------------------------------
// A short video, and a PDF
// ------------------------------------------------------------
export function VideoBubble({ uri, mine }: { uri: string; mine: boolean }) {
  // expo-video is native: loaded only when a video is shown, so an older build without it still opens the chat
  let Video: typeof import('expo-video') | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module
    Video = require('expo-video') as typeof import('expo-video');
  } catch {
    Video = null;
  }
  if (!Video) return <FileBubble name="Video" uri={uri} mine={mine} icon="play" />;
  return <VideoInner Video={Video} uri={uri} />;
}

function VideoInner({ Video, uri }: { Video: typeof import('expo-video'); uri: string }) {
  const player = Video.useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <Video.VideoView player={player} style={styles.video} nativeControls contentFit="cover" accessibilityLabel={nb.innboks.chat.video} />;
}

export function FileBubble({ name, uri, mine, icon = 'file' }: { name: string; uri: string; mine: boolean; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={nb.innboks.chat.fileOpen(name)} onPress={() => void Linking.openURL(uri)} style={[styles.file, mine ? styles.fileMine : styles.fileTheirs]}>
      <View style={[styles.fileIc, mine ? styles.fileIcMine : styles.fileIcTheirs]}>
        <Icon name={icon} size={18} color={mine ? colors.ink : colors.white} />
      </View>
      <Text style={[styles.fileName, { color: mine ? colors.white : colors.ink }]} numberOfLines={2}>
        {name}
      </Text>
      <Icon name="download" size={16} color={mine ? colors.onInk72 : colors.mute} />
    </Pressable>
  );
}

// ------------------------------------------------------------
// A shared oppdrag (a minnaboapp.no/oppdrag/… link) as a card
// ------------------------------------------------------------
const OPPDRAG_LINK = /minnaboapp\.no\/oppdrag\/([A-Za-z0-9-]+)/;
export const sharedListingId = (textValue: string): string | null => OPPDRAG_LINK.exec(textValue)?.[1] ?? null;
export const oppdragUrl = (id: string) => `${SITE}/oppdrag/${id}`;

export function ListingLinkCard({ id, mine }: { id: string; mine: boolean }) {
  const { data: l } = useListing(id);
  if (!l) return null;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${nb.innboks.chat.listingOpen}: ${l.title}`} onPress={() => safePush(`/oppdrag/${id}`)} style={[styles.lcard, mine && styles.lcardMine]}>
      <CategoryArt category={categoryArtId(l.category.slug)} uri={l.images[0]?.url} width={52} height={52} radius={14} iconSize={22} />
      <View style={styles.flex}>
        <Text style={styles.lcardTitle} numberOfLines={2}>
          {l.title}
        </Text>
        <Text style={text.hint} numberOfLines={1}>
          {l.location.place || l.location.municipality}
        </Text>
      </View>
      <Icon name="right" size={16} color={colors.faint} />
    </Pressable>
  );
}

// ------------------------------------------------------------
// Edit a sent message
// ------------------------------------------------------------
export function EditMessageSheet({ message, busy, onClose, onSave }: { message: Message | null; busy: boolean; onClose: () => void; onSave: (text: string) => void }) {
  const [value, setValue] = useState('');
  const [forId, setForId] = useState<string | null>(null);
  if (message && forId !== message.id) {
    setForId(message.id);
    setValue(message.text);
  }
  return (
    <Sheet
      visible={!!message}
      onClose={onClose}
      title={nb.innboks.chat.editTitle}
      subtitle={nb.innboks.chat.editHint}
      footer={<Button label={nb.innboks.chat.editSave} variant="lime" icon="check" disabled={!value.trim()} loading={busy} onPress={() => onSave(value.trim())} />}
    >
      <Input value={value} onChangeText={setValue} multiline autoFocus accessibilityLabel={nb.innboks.chat.editTitle} />
    </Sheet>
  );
}

// ------------------------------------------------------------
// «Send senere»
// ------------------------------------------------------------
export function ScheduleSheet({ visible, busy, onClose, onSave }: { visible: boolean; busy: boolean; onClose: () => void; onSave: (text: string, sendAt: string) => void }) {
  const t = nb.innboks.chat;
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<'tomorrow8' | 'evening' | 'custom'>('tomorrow8');
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState('08:00');
  // the clock as the sheet opened: enough for «i morgen kl. 08» and the one-minute check
  const [now] = useState(() => Date.now());
  const at = (() => {
    const d = new Date(now);
    if (mode === 'tomorrow8') {
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      return d;
    }
    if (mode === 'evening') {
      d.setHours(18, 0, 0, 0);
      if (d.getTime() < now + 60_000) d.setDate(d.getDate() + 1);
      return d;
    }
    if (!day) return null;
    const [h, m] = time.split(':').map(Number);
    const c = new Date(day);
    c.setHours(h || 0, m || 0, 0, 0);
    return c;
  })();
  const ok = !!value.trim() && !!at && at.getTime() > now + 60_000;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t.scheduleTitle}
      scroll
      footer={<Button label={t.scheduleSave} variant="lime" icon="clock" disabled={!ok} loading={busy} onPress={() => {
            if (at) onSave(value.trim(), at.toISOString());
          }} />}
    >
      <Field label={t.scheduleText}>
        <Input value={value} onChangeText={setValue} multiline accessibilityLabel={t.scheduleText} />
      </Field>
      <Text style={[text.label, styles.mt12]}>{t.scheduleWhen}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {(['tomorrow8', 'evening', 'custom'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: mode === k }} onPress={() => setMode(k)} style={[styles.chip, mode === k && styles.chipOn]}>
            <Text style={[styles.chipText, mode === k && styles.chipTextOn]}>{t.scheduleOptions[k]}</Text>
          </Pressable>
        ))}
      </View>
      {mode === 'custom' ? (
        <View style={styles.when}>
          <DateField label={t.scheduleWhen} value={day} onChange={setDay} minToday />
          <TimeField label="Klokkeslett" value={time} onChange={setTime} />
        </View>
      ) : null}
      {at ? <Text style={[text.meta, styles.mt12]}>{t.scheduledAt(`${shortDate(at.toISOString())} kl. ${formatTime(at.toISOString())}`)}</Text> : null}
    </Sheet>
  );
}

export function ScheduledBar({ list, onCancel }: { list: ScheduledMessage[]; onCancel: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <View style={styles.sched} testID="scheduled-bar">
      <Icon name="clock" size={15} color={colors.cyanDeep} />
      <View style={styles.flex}>
        <Text style={styles.schedTitle}>{nb.innboks.chat.scheduled(list.length)}</Text>
        <Text style={text.hint} numberOfLines={1}>
          {`${nb.innboks.chat.scheduledAt(`${shortDate(list[0].sendAt)} kl. ${formatTime(list[0].sendAt)}`)}: «${list[0].text}»`}
        </Text>
      </View>
      <Button label={nb.innboks.chat.cancel} variant="text" size="sm" block={false} onPress={() => onCancel(list[0].id)} />
    </View>
  );
}

// ------------------------------------------------------------
// «Del adresse»
// ------------------------------------------------------------
export function AddressSheet({ visible, busy, onClose, onSave }: { visible: boolean; busy: boolean; onClose: () => void; onSave: (address: string, note: string) => void }) {
  const t = nb.innboks.chat;
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t.addressTitle}
      scroll
      footer={<Button label={t.addressSend} variant="lime" icon="home" disabled={address.trim().length < 3} loading={busy} onPress={() => onSave(address.trim(), note.trim())} />}
    >
      <Note icon="shield">{t.addressInfo}</Note>
      <Field label={t.addressLabel} style={styles.mt12}>
        <Input value={address} onChangeText={setAddress} maxLength={200} placeholder={t.addressPh} accessibilityLabel={t.addressLabel} />
      </Field>
      <Field label={t.addressNote} style={styles.mt12}>
        <Input value={note} onChangeText={setNote} maxLength={200} placeholder={t.addressNotePh} accessibilityLabel={t.addressNote} />
      </Field>
    </Sheet>
  );
}

export function AddressCards({ list, meId, otherName, onRevoke }: { list: SharedAddress[]; meId: string; otherName: string; onRevoke: () => void }) {
  if (!list.length) return null;
  return (
    <View style={styles.gap8}>
      {list.map((a) => {
        const mine = a.fromId === meId;
        return (
          <View key={a.id} style={[styles.addr, shadow.card]} testID="address-card">
            <View style={styles.addrIc}>
              <Icon name="home" size={16} color={colors.limeDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.addrLabel}>{mine ? nb.innboks.chat.addressMine : nb.innboks.chat.addressCard(otherName)}</Text>
              <Text style={styles.addrText} selectable>
                {a.address}
              </Text>
              {a.note ? <Text style={text.hint}>{a.note}</Text> : null}
            </View>
            {mine ? <Button label={nb.innboks.chat.addressRevoke} variant="text" size="sm" block={false} onPress={onRevoke} /> : null}
          </View>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------
// «Del et oppdrag»
// ------------------------------------------------------------
export function ListingPickSheet({ visible, kommune, exceptId, onClose, onPick }: { visible: boolean; kommune?: string; exceptId?: string; onClose: () => void; onPick: (l: Listing) => void }) {
  const { data } = useListings(kommune ? { municipalities: [kommune], type: 'TASK_REQUEST' } : { type: 'TASK_REQUEST' }, 'NEWEST', visible);
  const list = (data ?? []).filter((l) => l.id !== exceptId).slice(0, 25);
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.innboks.chat.listingTitle} scroll heightRatio={0.8}>
      {list.length ? (
        <ListGroup>
          {list.map((l) => (
            <ListRow key={l.id} icon="clip" title={l.title} subtitle={l.location.place || l.location.municipality} onPress={() => onPick(l)} />
          ))}
        </ListGroup>
      ) : (
        <Note icon="info">{nb.innboks.chat.listingEmpty}</Note>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------
// «Om samtalen»
// ------------------------------------------------------------
export function AboutChatSheet({
  visible,
  c,
  messages,
  agreementId,
  onClose,
  onPhotos,
  onJump,
}: {
  visible: boolean;
  c: Conversation;
  messages: Message[];
  agreementId?: string;
  onClose: () => void;
  onPhotos: () => void;
  onJump: (m: Message) => void;
}) {
  const t = nb.innboks.chat;
  const alive = messages.filter((m) => !m.deletedAt);
  const photos = alive.filter((m) => m.kind === 'IMAGE');
  const voices = alive.filter((m) => m.kind === 'AUDIO');
  const videos = alive.filter((m) => m.attachmentKind === 'VIDEO');
  const files = alive.filter((m) => m.attachmentKind === 'FILE');
  const first = messages[0];
  return (
    <Sheet visible={visible} onClose={onClose} title={t.about} subtitle={first ? t.aboutStarted(shortDate(first.createdAt)) : undefined} scroll heightRatio={0.85}>
      <View style={styles.gap14}>
        <ListGroup>
          {c.listing.id ? <ListRow icon="clip" title={t.aboutListing} subtitle={c.listing.title} onPress={() => safePush(`/oppdrag/${c.listing.id}`)} /> : null}
          {agreementId ? <ListRow icon="hand" title={t.aboutAgreement} onPress={() => safePush(`/avtale/${agreementId}`)} /> : null}
        </ListGroup>
        <ListGroup>
          <ListRow icon="image" title={t.aboutPhotos(photos.length)} onPress={photos.length ? onPhotos : undefined} />
          <ListRow icon="play" title={t.aboutVideos(videos.length)} />
          <ListRow icon="mic" title={t.aboutVoice(voices.length)} />
          <ListRow icon="file" title={t.aboutFiles(files.length)} />
        </ListGroup>
        {files.length || voices.length || videos.length ? (
          <ListGroup>
            {[...files, ...videos, ...voices].map((m) => (
              <ListRow
                key={m.id}
                icon={m.attachmentKind === 'FILE' ? 'file' : m.attachmentKind === 'VIDEO' ? 'play' : 'mic'}
                title={m.fileName ?? (m.kind === 'AUDIO' ? nb.chat.voiceMessage : nb.innboks.chat.video)}
                subtitle={shortDate(m.createdAt)}
                onPress={() => onJump(m)}
              />
            ))}
          </ListGroup>
        ) : (
          <Text style={text.meta}>{t.aboutNone}</Text>
        )}
      </View>
    </Sheet>
  );
}

// ------------------------------------------------------------
// Notes at the top of a conversation
// ------------------------------------------------------------
export function TopNote({
  tone,
  icon,
  title,
  body,
  actions,
  testID,
}: {
  tone: 'warn' | 'ok' | 'ink' | 'cyan';
  icon: IconName;
  title: string;
  body?: string;
  actions?: { label: string; onPress: () => void; primary?: boolean }[];
  testID?: string;
}) {
  const look = { warn: [colors.warnTint, colors.warn], ok: [colors.okTint, colors.okText], ink: [colors.ink, colors.lime], cyan: [colors.cyanTint, colors.cyanDeep] }[tone];
  const dark = tone === 'ink';
  return (
    <View style={[styles.note, { backgroundColor: look[0] }]} testID={testID}>
      <View style={styles.noteHead}>
        <Icon name={icon} size={16} color={look[1]} />
        <Text style={[styles.noteTitle, dark && styles.white]}>{title}</Text>
      </View>
      {body ? <Text style={[text.meta, dark && styles.onInk]}>{body}</Text> : null}
      {actions?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.noteBtns}>
          {actions.map((a) => (
            <Button key={a.label} label={a.label} variant={a.primary ? 'lime' : dark ? 'ghost' : 'ghost'} size="sm" block={false} flat onPress={a.onPress} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  white: { color: colors.white },
  onInk: { color: colors.onInk75 },
  mt12: { marginTop: 12 },
  gap8: { gap: 8 },
  gap14: { gap: 14 },
  video: { width: 220, height: 280, borderRadius: 16, backgroundColor: colors.ink },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 230, padding: 6 },
  fileMine: {},
  fileTheirs: {},
  fileIc: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fileIcMine: { backgroundColor: colors.lime },
  fileIcTheirs: { backgroundColor: colors.ink },
  fileName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14 },
  lcard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, padding: 8, borderRadius: 16, backgroundColor: colors.white, minWidth: 220 },
  lcardMine: {},
  lcardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface2, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  chipTextOn: { color: colors.white },
  when: { gap: 10, marginTop: 12 },
  sched: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: radius.tile, backgroundColor: colors.cyanTint },
  schedTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  addr: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.tile, backgroundColor: colors.white },
  addrIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  addrLabel: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.3, textTransform: 'uppercase', color: colors.mute },
  addrText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  note: { padding: 12, borderRadius: radius.tile, gap: 6 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  noteBtns: { gap: 8 },
});
