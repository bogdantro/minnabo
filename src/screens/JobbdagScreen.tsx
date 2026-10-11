import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming, Easing } from 'react-native-reanimated';
import { categoryArtId } from '@/domain/categories';
import { formatPrice, groupThousands } from '@/domain/price';
import nb from '@/i18n/nb';
import {
  useAgreementByProposal,
  useJobWorkspace,
  useListing,
  useProfile,
  useProposal,
  useReportNoShow,
  useSendMessage,
  useUpdateJobWorkspace,
  useSharedContact,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { confirm } from '@/lib/confirm';
import { formatTime } from '@/lib/datetime';
import { parseDurationHours } from '@/lib/deviceCalendar';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { pickAndUploadMany } from '@/lib/uploads';
import { colors, fonts, motion, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import { TryggTurCard } from '@/components/TryggTurCard';
import { BeforeAfter } from '@/components/BeforeAfter';
import {
  AmountInput,
  Avatar,
  Button,
  CategoryArt,
  Checkbox,
  ErrorText,
  FadeUp,
  Field,
  Icon,
  IconButton,
  Input,
  Note,
  PhotoAddTile,
  ScaleIn,
  Screen,
  Segmented,
  Sheet,
  StickyFooter,
  SubHeader,
  Tabs,
} from '@/components/ui';
import type { ChecklistItem, JobParty, JobPhotoPhase, MaterialPayer } from '@/domain/types';

type Tab = 'sjekk' | 'mat' | 'bilder';
type Run = 'idle' | 'running' | 'paused' | 'stopped';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 28;
const C = 2 * Math.PI * R;
const pad = (n: number) => String(n).padStart(2, '0');
const dur = (ms: number) => {
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  return h ? `${h} t ${min % 60} min` : `${min} min`;
};

/** Jobbdag (design/screens/Jobbdag.dc.html). */
export function JobbdagScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const { data: agreement } = useAgreementByProposal(proposalId);
  const { data: listing } = useListing(proposal?.listingId ?? '');
  const otherId = proposal ? (proposal.fromProfileId === me.id ? proposal.toProfileId : proposal.fromProfileId) : '';
  const { data: other } = useProfile(otherId);
  // the number from Vipps, shared because you have an avtale (0057)
  const contact = useSharedContact(otherId || undefined).data;
  const { data: ws } = useJobWorkspace(proposalId);
  const update = useUpdateJobWorkspace(proposalId);
  const noShow = useReportNoShow();
  const sendMessage = useSendMessage(proposal?.conversationId ?? '', me.id);

  const [tab, setTab] = useState<Tab>('sjekk');
  const [now, setNow] = useState(() => Date.now());
  const [newItem, setNewItem] = useState('');
  const [matOpen, setMatOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');

  const running = ws?.timerStartedAt != null;
  // the clock also ticks during a pause ("Pauser" counts up)
  const ticking = running || ws?.pausedAt != null;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  if (!proposal) {
    return <FallbackScreen status={isError ? 'error' : isLoading ? 'loading' : 'empty'} onRetry={() => refetch()} title={nb.jobWorkspace.screenTitle} />;
  }

  const first = (other?.displayName ?? '').split(' ')[0];
  const run: Run = running ? 'running' : ws?.timerStoppedAt ? 'stopped' : ws && ws.timerAccumMs > 0 ? 'paused' : 'idle';
  const paused = ws ? ws.pausedMs + (ws.pausedAt ? Math.max(0, now - ws.pausedAt) : 0) : 0;
  // CLIENT posted the oppdrag (received the tilbud), HELPER sent it.
  const iAmHelper = proposal.fromProfileId === me.id;
  const myFirst = me.displayName.split(' ')[0];
  const party = {
    CLIENT: iAmHelper
      ? { name: first, initials: other?.initials ?? '·', uri: other?.avatarUrl, me: false }
      : { name: myFirst, initials: me.initials, uri: me.avatarUrl, me: true },
    HELPER: iAmHelper
      ? { name: myFirst, initials: me.initials, uri: me.avatarUrl, me: true }
      : { name: first, initials: other?.initials ?? '·', uri: other?.avatarUrl, me: false },
  };
  const tracked = ws ? ws.timerAccumMs + (ws.timerStartedAt ? Math.max(0, now - ws.timerStartedAt) : 0) : 0;
  const secs = Math.floor(tracked / 1000);
  const hh = Math.floor(secs / 3600);
  const mm = Math.floor((secs % 3600) / 60);
  const ss = secs % 60;
  const estText = agreement?.durationText ?? proposal.durationText ?? listing?.task?.durationText;
  const estMs = estText ? parseDurationHours(estText) * 3_600_000 : 0;
  const pct = estMs ? Math.min(100, Math.round((tracked / estMs) * 100)) : 0;
  const items = ws?.checklist ?? [];
  const done = items.filter((x) => x.done).length;
  const mats = ws?.materials ?? [];
  const sum = mats.reduce((a, m) => a + m.amountKr, 0);
  const sumOf = (payer: MaterialPayer) => mats.filter((m) => (m.payer ?? 'CLIENT') === payer).reduce((a, m) => a + m.amountKr, 0);
  const befores = ws?.photos.filter((p) => p.phase === 'BEFORE') ?? [];
  const afters = ws?.photos.filter((p) => p.phase === 'AFTER') ?? [];
  const pairs = Math.min(befores.length, afters.length);
  const extras = [...befores.slice(pairs), ...afters.slice(pairs), ...(ws?.photos.filter((p) => p.phase === 'DURING') ?? [])];
  const phaseLabel = { BEFORE: nb.jobWorkspace.before, AFTER: nb.jobWorkspace.after, DURING: nb.jobWorkspace.alongTheWay };
  const clock = (iso?: string) => (iso ? `kl. ${formatTime(iso)}` : null);
  const photoCount = ws?.photos.length ?? 0;
  const cat = categoryArtId(listing?.category.slug ?? 'annet');
  const when = agreement?.scheduledText ?? proposal.scheduledText;

  const toggle = () => {
    haptics.light();
    update.mutate({ kind: 'toggleTimer' });
  };
  const start = () => {
    if (!running) toggle();
    toast.info(nb.jobWorkspace.resumedToast, { icon: 'play', bottom: 150 });
  };
  const pause = () => {
    if (running) toggle();
    toast.info(nb.jobWorkspace.pausedToast, { icon: 'pause', bottom: 150 });
  };
  const stop = () => {
    haptics.light();
    update.mutate({ kind: 'stopTimer' });
    toast.info(nb.jobWorkspace.stoppedToast(dur(tracked)), { icon: 'clock', bottom: 150 });
  };
  const toggleItem = (id: string) => {
    const it = items.find((x) => x.id === id);
    update.mutate({ kind: 'toggleChecklist', itemId: id });
    if (it && !it.done && items.every((x) => x.id === id || x.done)) toast.success(nb.jobWorkspace.allDoneToast, { icon: 'check', bottom: 150 });
  };
  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    update.mutate({ kind: 'addChecklist', text: t });
    setNewItem('');
    toast.success(nb.jobWorkspace.addedToast, { icon: 'plus', bottom: 150 });
  };
  // Felles → client → helper → Felles
  const cycleWho = (it: ChecklistItem) => {
    const next: JobParty | undefined = !it.who ? 'CLIENT' : it.who === 'CLIENT' ? 'HELPER' : undefined;
    haptics.light();
    update.mutate({ kind: 'setChecklistWho', itemId: it.id, who: next });
  };
  const addPhoto = async (phase: JobPhotoPhase) => {
    setUploading(true);
    try {
      const res = await pickAndUploadMany({ bucket: 'listing-images', folder: me.id, max: 10 });
      for (const r of res) update.mutate({ kind: 'addPhoto', url: r.publicUrl, phase, caption: caption.trim() || undefined });
      if (res.length) {
        setCaption('');
        setPhotoOpen(false);
        toast.success(nb.jobWorkspace.photoShared(first), { icon: 'image', bottom: 150 });
      }
    } catch (e) {
      toast.error((e as Error).message || nb.jobWorkspace.uploadFailed);
    } finally {
      setUploading(false);
    }
  };
  const status = (t: string) => {
    sendMessage.mutate(t);
    toast.success(nb.avtale.statusSent, { bottom: 150 });
  };
  const reportNoShow = async () => {
    const ok = await confirm({ title: nb.avtale.noShowConfirmTitle, message: nb.avtale.noShowConfirmBody, confirmLabel: nb.avtale.noShowConfirm, destructive: true });
    if (!ok || !otherId) return;
    noShow.mutate(
      { agreementProposalId: proposalId, profileId: otherId },
      { onSuccess: () => toast.success(nb.avtale.noShowToast), onError: () => toast.error(nb.toast.genericError) },
    );
  };
  const phone = contact?.phone?.replace(/\s/g, '');

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        header={
          <SubHeader
            title={nb.jobWorkspace.screenTitle}
            onBack={() => (router.canGoBack() ? router.back() : router.replace(`/avtale/${proposalId}`))}
            right={<LivePill run={run} />}
            sideWidth={96}
          />
        }
      >
        {/* summary strip */}
        <FadeUp style={[styles.px, styles.mt6]}>
          <View style={[styles.card, styles.strip, shadow.card]}>
            <CategoryArt category={cat} uri={listing?.images[0]?.url} width={48} height={48} radius={15} iconSize={22} />
            <View style={styles.flex1}>
              <Text style={[text.label, styles.f155]} numberOfLines={1}>
                {listing?.title ?? ''}
              </Text>
              <Text style={text.meta} numberOfLines={1}>
                {[when, listing?.location.place || listing?.location.municipality].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={styles.avs}>
              <View style={styles.avRing}>
                <Avatar initials={me.initials} uri={me.avatarUrl} me size={32} ring={false} />
              </View>
              <View style={[styles.avRing, styles.avOverlap]}>
                <Avatar initials={other?.initials ?? '·'} uri={other?.avatarUrl} seed={otherId} size={32} ring={false} />
              </View>
            </View>
            <IconButton icon="msg" iconSize={18} accessibilityLabel={nb.jobWorkspace.openChat(first)} onPress={() => safePush(`/chat/${proposal.conversationId}`)} />
          </View>
        </FadeUp>

        {/* time tracker */}
        <FadeUp delay={100} style={[styles.px, styles.mt14]}>
          <View style={[styles.hero, shadow.hero]}>
            <View style={styles.glow} />
            <View style={styles.glow2} />
            <View style={styles.between}>
              <Text style={[text.eyebrow, { color: colors.onInk62 }]}>{nb.jobWorkspace.workToday}</Text>
              <View style={styles.row6}>
                <Icon name="clock" size={14} color={colors.onInk72} />
                <Text style={styles.heroState}>{nb.jobWorkspace.state[run]}</Text>
              </View>
            </View>
            <View style={styles.digits} accessibilityRole="timer" accessibilityLabel={nb.jobWorkspace.timerA11y(hh, mm)}>
              <Text style={[styles.digit, run !== 'running' && styles.dim]}>{pad(hh)}</Text>
              <Text style={[styles.digit, styles.colon]}>:</Text>
              <Text style={[styles.digit, run !== 'running' && styles.dim]}>{pad(mm)}</Text>
              <Text style={[styles.digit, styles.colon]}>:</Text>
              <Text style={[styles.digit, styles.sec, run !== 'running' && styles.secDim]}>{pad(ss)}</Text>
            </View>
            {estMs ? (
              <>
                <View style={styles.hbar}>
                  <View style={[styles.hbarFill, { width: `${pct}%` }]} />
                </View>
                <View style={[styles.between, styles.mt7]}>
                  <Text style={styles.heroSmall}>{nb.jobWorkspace.ofEstimate(pct)}</Text>
                  <Text style={styles.heroSmall}>{nb.jobWorkspace.estimate(`ca. ${String(parseDurationHours(estText)).replace(".", ",")} t`)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.hstats}>
              <HStat label={nb.jobWorkspace.started} value={ws?.firstStartedAt ? `kl. ${formatTime(new Date(ws.firstStartedAt).toISOString())}` : '–'} />
              <HStat label={nb.jobWorkspace.pauses} value={dur(paused)} />
              <HStat label={nb.jobWorkspace.total} value={dur(tracked)} />
            </View>
            <View style={styles.hbtns}>
              <Button label={run === 'idle' ? nb.jobWorkspace.startBtn : nb.jobWorkspace.resume} icon="play" disabled={running} onPress={start} style={styles.g12} />
              <HeroBtn label={nb.jobWorkspace.pause} icon="pause" disabled={!running} onPress={pause} />
              <HeroBtn label={nb.jobWorkspace.stopBtn} stop disabled={run === 'stopped' || run === 'idle'} onPress={stop} />
            </View>
          </View>
        </FadeUp>

        {/* tabs */}
        <FadeUp delay={150} style={styles.mt22}>
          <Tabs
            tabs={[
              { value: 'sjekk', label: nb.jobWorkspace.tabs.sjekk, count: undefined },
              { value: 'mat', label: nb.jobWorkspace.tabs.mat },
              { value: 'bilder', label: nb.jobWorkspace.tabs.bilder },
            ]}
            value={tab}
            onChange={setTab}
            badges={{ sjekk: `${done}/${items.length}`, mat: String(mats.length), bilder: String(photoCount) }}
          />
        </FadeUp>

        <View style={[styles.px, styles.mt16, styles.gap12]}>
          {tab === 'sjekk' ? (
            <>
              <View style={[styles.card, styles.ringcard, shadow.card]}>
                <Ring frac={items.length ? done / items.length : 0} label={`${items.length ? Math.round((done / items.length) * 100) : 0}%`} />
                <View style={styles.flex1}>
                  <Text style={styles.ringBig}>{nb.jobWorkspace.tasksDone(done, items.length)}</Text>
                  <Text style={text.meta}>{nb.jobWorkspace.tasksSub}</Text>
                </View>
              </View>
              {items.length > 0 && done === items.length ? (
                <ScaleIn style={styles.alldone}>
                  <View style={styles.okIc}>
                    <Icon name="check" size={18} color={colors.white} />
                  </View>
                  <Text style={styles.alldoneText}>{nb.jobWorkspace.allDone}</Text>
                </ScaleIn>
              ) : null}
              <View style={[styles.card, styles.list, shadow.card]}>
                {items.length === 0 ? <Text style={[text.meta, styles.emptyLine]}>{nb.jobWorkspace.emptyTasks}</Text> : null}
                {items.map((it, i) => (
                  <Pressable
                    key={it.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: it.done }}
                    accessibilityLabel={it.text}
                    accessibilityHint={nb.jobWorkspace.removeTask(it.text)}
                    onPress={() => toggleItem(it.id)}
                    onLongPress={() => update.mutate({ kind: 'removeChecklist', itemId: it.id })}
                    style={styles.task}
                  >
                    {i > 0 ? <View style={styles.taskLine} /> : null}
                    <Checkbox checked={it.done} />
                    <StrikeText textValue={it.text} done={it.done} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={nb.jobWorkspace.whoA11y(it.who ? party[it.who].name : nb.jobWorkspace.shared)}
                      accessibilityHint={nb.jobWorkspace.whoHint}
                      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                      onPress={() => cycleWho(it)}
                      style={styles.who}
                    >
                      {it.who ? (
                        <Avatar initials={party[it.who].initials} uri={party[it.who].uri} me={party[it.who].me} seed={otherId} size={22} ring={false} />
                      ) : (
                        <View style={styles.whoShared}>
                          <Icon name="users" size={12} color={colors.mute} />
                        </View>
                      )}
                      <Text style={styles.whoText}>{it.who ? party[it.who].name : nb.jobWorkspace.shared}</Text>
                    </Pressable>
                  </Pressable>
                ))}
                <View style={styles.addrow}>
                  <TextInput
                    value={newItem}
                    onChangeText={setNewItem}
                    onSubmitEditing={addItem}
                    returnKeyType="done"
                    placeholder={nb.jobWorkspace.taskPh}
                    placeholderTextColor={colors.placeholder}
                    accessibilityLabel={nb.jobWorkspace.newTask}
                    style={styles.addInput}
                  />
                  <Button label={nb.jobWorkspace.add} icon="plus" variant="ink" size="sm" block={false} disabled={!newItem.trim()} onPress={addItem} style={styles.addBtn} />
                </View>
              </View>
            </>
          ) : tab === 'mat' ? (
            <>
              <View style={[styles.card, styles.list, shadow.card]}>
                {mats.length === 0 ? <Text style={[text.meta, styles.emptyLine]}>{nb.jobWorkspace.emptyMaterials}</Text> : null}
                {mats.map((m, i) => (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.label}, ${m.amountKr ? formatPrice({ amountMinor: m.amountKr * 100, currency: 'NOK' }) : nb.jobWorkspace.bringsOwn}`}
                    onLongPress={() => update.mutate({ kind: 'removeMaterial', itemId: m.id })}
                    style={styles.mat}
                  >
                    {i > 0 ? <View style={styles.matLine} /> : null}
                    <View style={styles.mi}>
                      <Icon name="tag" size={18} color={colors.limeDeep} />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.matName}>{m.label}</Text>
                      <WhoPill payer={m.payer ?? 'CLIENT'} party={party} />
                    </View>
                    <View style={styles.mamt}>
                      <Text style={styles.mamtB}>{m.amountKr ? `${groupThousands(m.amountKr)} kr` : nb.jobWorkspace.bringsOwn}</Text>
                      <Text style={styles.mamtS}>
                        {m.payer === 'HELPER_OUTLAY' ? nb.jobWorkspace.outlay : m.amountKr ? nb.jobWorkspace.approx : nb.jobWorkspace.ownGear}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <View style={styles.sumrow}>
                  <View>
                    <Text style={[text.label, styles.f15]}>{nb.jobWorkspace.sumMaterials}</Text>
                    <Text style={[text.meta, styles.mt3]}>
                      {sum
                        ? nb.jobWorkspace.split(party.CLIENT.name, `${groupThousands(sumOf('CLIENT'))} kr`, party.HELPER.name, `${groupThousands(sumOf('HELPER_OUTLAY'))} kr`)
                        : nb.jobWorkspace.materialsCount(mats.length)}
                    </Text>
                  </View>
                  <Text style={[text.num, styles.f24]}>{`${groupThousands(sum)} kr`}</Text>
                </View>
              </View>
              <Note>{nb.jobWorkspace.matNote}</Note>
              <Button label={nb.jobWorkspace.addMaterial} icon="plus" variant="ghost" onPress={() => setMatOpen(true)} />
            </>
          ) : (
            <>
              {Array.from({ length: pairs }, (_, i) => (
                <View key={befores[i].id} style={[styles.card, styles.pair, shadow.card]}>
                  <BeforeAfter before={befores[i].url} after={afters[i].url} accessibilityLabel={nb.jobWorkspace.compareA11y(i + 1)} />
                  <View style={styles.pairFoot}>
                    <View style={styles.flex1}>
                      <Text style={[text.label, styles.f15]}>{befores[i].caption ?? afters[i].caption ?? nb.jobWorkspace.pairTitle(i + 1)}</Text>
                      {clock(befores[i].at) && clock(afters[i].at) ? (
                        <Text style={text.meta}>{nb.jobWorkspace.pairMeta(clock(befores[i].at)!, clock(afters[i].at)!)}</Text>
                      ) : null}
                    </View>
                    <View style={styles.pill}>
                      <Icon name="image" size={14} color={colors.ink2} />
                      <Text style={styles.pillText}>{nb.jobWorkspace.twoPhotos}</Text>
                    </View>
                  </View>
                </View>
              ))}
              <View>
                <View style={styles.labelRow}>
                  <Text style={text.label}>{nb.jobWorkspace.alongTheWay}</Text>
                  <Text style={text.hint}>{nb.jobWorkspace.photosCount(extras.length)}</Text>
                </View>
                <View style={styles.pgrid}>
                  {extras.map((p) => (
                    <View key={p.id} style={styles.ptile}>
                      <CategoryArt category={cat} uri={p.url} width="100%" height="100%" radius={18} />
                      <Text style={styles.fchip} numberOfLines={1}>
                        {p.caption ?? phaseLabel[p.phase]}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.ptile}>
                    <PhotoAddTile onPress={() => setPhotoOpen(true)} label={nb.jobWorkspace.addPhoto} />
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        {/* safety + contact (existing job-day tools) */}
        <FadeUp delay={200} style={[styles.px, styles.mt22, styles.gap12]}>
          <Text style={text.eyebrow}>{nb.jobWorkspace.safety}</Text>
          <View style={styles.row8}>
            <Button label={nb.avtale.enRoute} icon="nav" variant="ghost" size="sm" block={false} onPress={() => status('Jeg er på vei 🚗')} style={styles.grow} />
            <Button label={nb.avtale.arrived} icon="pin" variant="ghost" size="sm" block={false} onPress={() => status('Jeg er framme 👋')} style={styles.grow} />
          </View>
          {phone ? (
            <View style={styles.row8}>
              <Button label={nb.avtale.call} icon="phone" variant="ghost" size="sm" block={false} onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.grow} />
              <Button label={nb.avtale.sms} icon="msg" variant="ghost" size="sm" block={false} onPress={() => Linking.openURL(`sms:${phone}`)} style={styles.grow} />
            </View>
          ) : null}
          <TryggTurCard
            context={{
              proposalId,
              title: listing?.title ?? '',
              who: other?.displayName,
              place: listing ? listing.location.place || listing.location.municipality : undefined,
            }}
          />
          <Button label={nb.avtale.reportNoShow} variant="text" loading={noShow.isPending} onPress={reportNoShow} />
        </FadeUp>
        <View style={styles.bottom} />
      </Screen>

      <StickyFooter>
        <Button label={nb.jobWorkspace.finish} icon="check" size="lg" onPress={() => safePush(`/fullfor/${proposalId}`)} />
        <Text style={[text.meta, styles.center, styles.f12, styles.mt6]}>{nb.jobWorkspace.finishNote(first)}</Text>
      </StickyFooter>

      <MaterialSheet
        visible={matOpen}
        onClose={() => setMatOpen(false)}
        party={party}
        onAdd={(label, amountKr, payer) => {
          update.mutate({ kind: 'addMaterial', label, amountKr, payer });
          setMatOpen(false);
          toast.success(nb.jobWorkspace.matAdded(label), { icon: 'plus', bottom: 150 });
        }}
      />
      <Sheet visible={photoOpen} onClose={() => setPhotoOpen(false)} title={nb.jobWorkspace.photoPhase} titleSize="h2">
        <View style={styles.gap10}>
          <Field label={nb.jobWorkspace.captionLabel} hint={nb.jobWorkspace.optional}>
            <Input value={caption} onChangeText={setCaption} placeholder={nb.jobWorkspace.captionPh} maxLength={40} accessibilityLabel={nb.jobWorkspace.captionLabel} />
          </Field>
          <Button label={nb.jobWorkspace.photoBefore} icon="image" variant="ghost" loading={uploading} onPress={() => void addPhoto('BEFORE')} />
          <Button label={nb.jobWorkspace.photoDuring} icon="camera" variant="ghost" loading={uploading} onPress={() => void addPhoto('DURING')} />
          <Button label={nb.jobWorkspace.photoAfter} icon="image" loading={uploading} onPress={() => void addPhoto('AFTER')} />
        </View>
      </Sheet>
    </View>
  );
}

function LivePill({ run }: { run: Run }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (run === 'running' && !reduced) p.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false));
    else p.set(0);
  }, [run, reduced, p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - p.value), transform: [{ scale: 1 + p.value * 1.2 }] }));
  const tone = run === 'running' ? { bg: colors.limeTint, fg: colors.limeDeep } : run === 'paused' ? { bg: colors.warnTint, fg: colors.warn } : { bg: colors.neutralPill, fg: colors.ink2 };
  return (
    <View style={[styles.live, { backgroundColor: tone.bg }]} accessibilityRole="text" accessibilityLiveRegion="polite">
      <View>
        {run === 'running' ? <Animated.View style={[styles.liveRing, ring]} /> : null}
        <View style={[styles.liveDot, { backgroundColor: run === 'running' ? colors.liveGreen : tone.fg }]} />
      </View>
      <Text style={[styles.liveText, { color: tone.fg }]}>{nb.jobWorkspace.live[run]}</Text>
    </View>
  );
}

function HStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.hstat}>
      <Text style={styles.hstatL}>{label}</Text>
      <Text style={styles.hstatV} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function HeroBtn({ label, icon, stop, disabled, onPress }: { label: string; icon?: 'pause'; stop?: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.hbtn, stop ? styles.hbtnStop : styles.hbtnGlass, disabled && styles.hbtnDis, pressed && styles.pressed]}
    >
      {stop ? <View style={styles.stopSq} /> : <Icon name={icon ?? 'pause'} size={16} color={colors.white} />}
      <Text style={[styles.hbtnText, stop && { color: colors.stopText }]}>{label}</Text>
    </Pressable>
  );
}

function Ring({ frac, label }: { frac: number; label: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withSpring(frac, motion.spring));
  }, [frac, p]);
  const props = useAnimatedProps(() => ({ strokeDasharray: [Math.max(0, p.value) * C, C], strokeOpacity: p.value > 0.005 ? 1 : 0 }));
  return (
    <View style={styles.ring}>
      <Svg width={72} height={72} viewBox="0 0 72 72" style={styles.ringSvg}>
        <Circle cx={36} cy={36} r={R} fill="none" stroke={colors.track} strokeWidth={8} />
        <AnimatedCircle cx={36} cy={36} r={R} fill="none" stroke={colors.limeDot} strokeWidth={8} strokeLinecap="round" animatedProps={props} />
      </Svg>
      <Text style={styles.ringV}>{label}</Text>
    </View>
  );
}

/** Task text with a strike line that draws across when done. */
function StrikeText({ textValue, done }: { textValue: string; done: boolean }) {
  const p = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(done ? 1 : 0, { duration: 400 }));
  }, [done, p]);
  const line = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={styles.flex1}>
      <Text style={[styles.tx, done && { color: colors.faint }]}>{textValue}</Text>
      <Animated.View style={[styles.strike, line]} />
    </View>
  );
}

type Party = Record<JobParty, { name: string; initials: string; uri?: string; me: boolean }>;
const PAYER_TONE: Record<MaterialPayer, { bg: string; fg: string }> = {
  CLIENT: { bg: colors.neutralPill, fg: colors.ink },
  HELPER: { bg: colors.cyanTint, fg: colors.cyanDeep },
  HELPER_OUTLAY: { bg: colors.warnTint, fg: colors.warn },
};
const payerLabel = (payer: MaterialPayer, party: Party) =>
  payer === 'CLIENT' ? nb.jobWorkspace.buys(party.CLIENT.name) : payer === 'HELPER' ? nb.jobWorkspace.brings(party.HELPER.name) : nb.jobWorkspace.paysOut(party.HELPER.name);

/** `.whop` – who sorts out a material. */
function WhoPill({ payer, party }: { payer: MaterialPayer; party: Party }) {
  const who = party[payer === 'CLIENT' ? 'CLIENT' : 'HELPER'];
  const tone = PAYER_TONE[payer];
  return (
    <View style={[styles.whop, { backgroundColor: tone.bg }]}>
      <Avatar initials={who.initials} uri={who.uri} me={who.me} seed={who.name} size={16} ring={false} />
      <Text style={[styles.whopText, { color: tone.fg }]}>{payerLabel(payer, party)}</Text>
    </View>
  );
}

function MaterialSheet({ visible, onClose, onAdd, party }: { visible: boolean; onClose: () => void; onAdd: (label: string, kr: number, payer: MaterialPayer) => void; party: Party }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<MaterialPayer>('CLIENT');
  const [err, setErr] = useState(0);
  const save = () => {
    const n = name.trim();
    if (!n) {
      setErr((e) => e + 1);
      return;
    }
    onAdd(n, Number(amount) || 0, payer);
    setName('');
    setAmount('');
    setPayer('CLIENT');
    setErr(0);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.jobWorkspace.addMaterial} titleSize="h2" scroll>
      <Field label={nb.jobWorkspace.matName}>
        <Input
          value={name}
          onChangeText={(v) => {
            setName(v);
            setErr(0);
          }}
          placeholder={nb.jobWorkspace.matNamePh}
          error={err > 0}
          accessibilityLabel={nb.jobWorkspace.matName}
        />
        {err > 0 ? <ErrorText shakeKey={err}>{nb.jobWorkspace.matNameErr}</ErrorText> : null}
      </Field>
      <Field label={nb.jobWorkspace.matAmount} hint={nb.jobWorkspace.optional} style={styles.mt16}>
        <AmountInput value={amount} onChangeText={setAmount} suffix="kr" accessibilityLabel={nb.jobWorkspace.matAmount} />
      </Field>
      <Text style={[text.label, styles.whoLabel]}>{nb.jobWorkspace.whoSorts}</Text>
      <Segmented
        accessibilityLabel={nb.jobWorkspace.whoSorts}
        value={payer}
        onChange={setPayer}
        options={(['CLIENT', 'HELPER', 'HELPER_OUTLAY'] as MaterialPayer[]).map((v) => ({ value: v, label: payerLabel(v, party) }))}
      />
      <Note style={styles.mt14}>{nb.jobWorkspace.matSheetNote}</Note>
      <Button label={nb.jobWorkspace.add} icon="plus" size="lg" onPress={save} style={styles.mt18} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1, minWidth: 0, gap: 2 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  g12: { flexGrow: 1.2, flexShrink: 1, flexBasis: 0, height: 50 },
  pressed: { transform: [{ scale: 0.97 }] },
  dim: { color: colors.onInk55 },
  f12: { fontSize: 12 },
  f15: { fontSize: 15 },
  f155: { fontSize: 15.5 },
  f24: { fontSize: 24 },
  gap10: { gap: 10 },
  gap12: { gap: 12 },
  mt3: { marginTop: 3 },
  mt6: { marginTop: 6 },
  mt7: { marginTop: 7 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8: { flexDirection: 'row', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { backgroundColor: colors.white, borderRadius: radius.card },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  avs: { flexDirection: 'row' },
  avRing: { borderRadius: 18, borderWidth: 2.5, borderColor: colors.white },
  avOverlap: { marginLeft: -10 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 32, paddingHorizontal: 12, borderRadius: radius.pill },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveRing: { position: 'absolute', top: 0, left: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.liveGreen },
  liveText: { fontFamily: text.label.fontFamily, fontSize: 12.5 },
  hero: { borderRadius: 30, backgroundColor: colors.ink, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 18, overflow: 'hidden' },
  glow: { position: 'absolute', right: -70, top: -90, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.lime, opacity: 0.38 },
  glow2: { position: 'absolute', left: -60, bottom: -110, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.cyan, opacity: 0.18 },
  heroState: { fontFamily: text.bodySemi.fontFamily, fontSize: 12.5, color: colors.onInk72 },
  digits: { flexDirection: 'row', alignItems: 'baseline', marginTop: 14, marginBottom: 4 },
  digit: { fontFamily: text.h1.fontFamily, fontSize: 58, lineHeight: 62, letterSpacing: -2.3, color: colors.white, fontVariant: ['tabular-nums'] },
  colon: { opacity: 0.4, marginHorizontal: 1 },
  sec: { color: colors.lime },
  secDim: { color: colors.limeHalf },
  hbar: { height: 6, borderRadius: 3, backgroundColor: colors.onInk12, overflow: 'hidden', marginTop: 12 },
  hbarFill: { height: '100%', borderRadius: 3, backgroundColor: colors.lime },
  heroSmall: { fontFamily: text.body.fontFamily, fontSize: 12, color: colors.onInk62 },
  hstats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  hstat: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: colors.onInk07, gap: 4 },
  hstatL: { fontFamily: text.bodySemi.fontFamily, fontSize: 11.5, color: colors.onInk62 },
  hstatV: { fontFamily: text.h3.fontFamily, fontSize: 15, lineHeight: 17, color: colors.white },
  hbtns: { flexDirection: 'row', gap: 8, marginTop: 16 },
  hbtn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 50, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  hbtnGlass: { backgroundColor: colors.onInk10, borderColor: colors.onInk16b },
  hbtnStop: { backgroundColor: colors.stopBg, borderColor: colors.stopBorder },
  hbtnDis: { opacity: 0.45 },
  hbtnText: { fontFamily: text.label.fontFamily, fontSize: 15, color: colors.white },
  stopSq: { width: 12, height: 12, borderRadius: 3, backgroundColor: colors.stopText },
  ringcard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  ring: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  ringV: { fontFamily: text.h3.fontFamily, fontSize: 17, color: colors.ink },
  ringBig: { fontFamily: text.h3.fontFamily, fontSize: 21, lineHeight: 23, letterSpacing: -0.42, color: colors.ink },
  alldone: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.okTint },
  okIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  alldoneText: { flex: 1, fontFamily: text.label.fontFamily, fontSize: 14.5, lineHeight: 19, color: colors.okText },
  list: { overflow: 'hidden' },
  emptyLine: { padding: 16 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  whoShared: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  whoText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.mute },
  whop: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginTop: 5, height: 22, paddingLeft: 3, paddingRight: 8, borderRadius: radius.pill },
  whopText: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
  whoLabel: { marginTop: 18, marginBottom: 10 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 60 },
  taskLine: { position: 'absolute', top: 0, left: 52, right: 0, height: 1, backgroundColor: colors.line2 },
  tx: { fontFamily: text.bodySemi.fontFamily, fontSize: 15, lineHeight: 20, color: colors.ink },
  strike: { position: 'absolute', top: '55%', left: 0, height: 1.5, backgroundColor: colors.faint },
  addrow: { flexDirection: 'row', gap: 8, padding: 12, paddingLeft: 14, borderTopWidth: 1, borderTopColor: colors.line2 },
  addInput: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  addBtn: { height: 46 },
  mat: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 66 },
  matLine: { position: 'absolute', top: 0, left: 66, right: 0, height: 1, backgroundColor: colors.line2 },
  mi: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  matName: { fontFamily: text.bodySemi.fontFamily, fontSize: 15, lineHeight: 19, color: colors.ink },
  mamt: { alignItems: 'flex-end' },
  mamtB: { fontFamily: text.h3.fontFamily, fontSize: 16, color: colors.ink },
  mamtS: { fontFamily: text.bodySemi.fontFamily, fontSize: 11, color: colors.mute, marginTop: 4 },
  sumrow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderTopColor: colors.line,
    backgroundColor: colors.surface2,
  },
  pair: { overflow: 'hidden' },
  pairFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.neutralPill },
  pillText: { fontFamily: text.label.fontFamily, fontSize: 12, color: colors.ink2 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  pgrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ptile: { width: '31%', aspectRatio: 1, borderRadius: 18, overflow: 'hidden' },
  fchip: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    height: 20,
    lineHeight: 20,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.galleryCap,
    fontFamily: text.label.fontFamily,
    fontSize: 10,
    color: colors.white,
  },
  bottom: { height: 160 },
});
