import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { PublicProfile } from '@/domain/types';
import nb from '@/i18n/nb';
import { useSession } from '@/auth/session';
import { useVippsIdentity } from '@/auth/mockVipps';
import { useProfile, useUpdateProfile } from '@/api/queries';
import { INNLANDET_KOMMUNER, WHOLE_KOMMUNE, profileAreas } from '@/data/kommuner';
import { pickAndUpload } from '@/lib/uploads';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { categoryColors, colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import {
  Avatar,
  Button,
  Chip,
  FadeInView,
  FadeUp,
  Field,
  Icon,
  Input,
  Note,
  Pill,
  PressableScale,
  Radio,
  ScaleIn,
  Screen,
  SelectBox,
  Sheet,
  Spinner,
  StickyFooter,
  SubHeader,
  TextLink,
  type IconName,
} from '@/components/ui';

const BIO_MAX = 400;
const PORT_MAX = 9;

type Form = {
  dn: string;
  bio: string;
  kom: string;
  area: string;
  notes: string;
  /** undefined = unchanged, null = remove, string = new storage path */
  avatarPath: string | null | undefined;
  portfolio: string[];
};

const snap = (f: Form) => JSON.stringify([f.dn, f.bio, f.kom, f.area, f.notes, f.avatarPath, f.portfolio]);

function initialForm(profile: PublicProfile): Form {
  const kom = profile.location.municipality || 'Lillehammer';
  const place = profile.location.place;
  return {
    dn: profile.displayName,
    bio: profile.presentation ?? '',
    kom,
    area: !place || place === kom ? WHOLE_KOMMUNE : place,
    notes: profile.homeNotes ?? '',
    avatarPath: undefined,
    portfolio: profile.portfolio ?? [],
  };
}

/** Rediger profil (design/screens/RedigerProfil.dc.html). */
export function EditProfileScreen() {
  const { userId } = useSession();
  const { data: profile, isLoading, isError, refetch } = useProfile(userId ?? '');
  // Don't render the form over a profile we couldn't load — saving it would
  // overwrite the real profile with empty strings.
  if (!profile) {
    return <FallbackScreen status={isError ? 'error' : isLoading ? 'loading' : 'error'} onRetry={() => refetch()} title={nb.editProfile.title} />;
  }
  return <EditProfileForm profile={profile} userId={userId ?? ''} />;
}

function EditProfileForm({ profile, userId }: { profile: PublicProfile; userId: string }) {
  const router = useRouter();
  const vipps = useVippsIdentity();
  const update = useUpdateProfile();

  const [base, setBase] = useState<Form>(() => initialForm(profile));
  const [form, setForm] = useState<Form>(() => initialForm(profile));
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [komOpen, setKomOpen] = useState(false);
  const [busy, setBusy] = useState<'avatar' | 'port' | null>(null);
  const removed = useRef<{ uri: string; idx: number } | null>(null);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = snap(form) !== snap(base);
  const dnBad = form.dn.trim().length === 0;
  const len = form.bio.length;
  const bioBad = len > BIO_MAX;
  const canSave = dirty && !dnBad && !bioBad && !update.isPending;
  // Keep the saved place selectable even when it isn't one of the quick picks.
  const areas = Array.from(new Set([...profileAreas(form.kom), ...(form.area ? [form.area] : [])]));
  const placeLabel = form.area === WHOLE_KOMMUNE ? form.kom : `${form.area}, ${form.kom}`;
  const avatarUri = preview === undefined ? profile.avatarUrl : preview ?? undefined;
  const photoNote =
    form.avatarPath === null ? nb.editProfile.photoRemoved : form.avatarPath ? nb.editProfile.photoNew : avatarUri ? null : nb.editProfile.photoNone;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profil'));

  const pickAvatar = async (source: 'camera' | 'library') => {
    setPhotoOpen(false);
    if (!userId) return;
    setBusy('avatar');
    try {
      const res = await pickAndUpload({ bucket: 'avatars', folder: userId, source });
      if (!res) return;
      setPreview(res.publicUrl);
      set({ avatarPath: res.path });
      toast.success(source === 'camera' ? nb.editProfile.photoTaken : nb.editProfile.photoPicked, { icon: source === 'camera' ? 'camera' : 'image', bottom: 150 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : nb.toast.avatarFailed, { bottom: 150 });
    } finally {
      setBusy(null);
    }
  };

  const removeAvatar = () => {
    setPhotoOpen(false);
    setPreview(null);
    set({ avatarPath: null });
    toast.success(nb.editProfile.photoRemovedToast, { icon: 'trash', bottom: 150 });
  };

  const addPortfolio = async () => {
    if (!userId || form.portfolio.length >= PORT_MAX || busy) return;
    setBusy('port');
    try {
      const res = await pickAndUpload({ bucket: 'listing-images', folder: userId, source: 'library' });
      if (res) setForm((f) => ({ ...f, portfolio: [...f.portfolio, res.publicUrl] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : nb.toast.genericError, { bottom: 150 });
    } finally {
      setBusy(null);
    }
  };

  const removePortfolio = (uri: string) => {
    const idx = form.portfolio.indexOf(uri);
    removed.current = { uri, idx };
    set({ portfolio: form.portfolio.filter((u) => u !== uri) });
    haptics.light();
    toast.success(nb.editProfile.portRemoved, {
      icon: 'trash',
      bottom: 150,
      action: {
        label: nb.editProfile.undo,
        onPress: () => {
          const r = removed.current;
          if (!r) return;
          removed.current = null;
          setForm((f) => {
            if (f.portfolio.includes(r.uri)) return f;
            const next = [...f.portfolio];
            next.splice(r.idx, 0, r.uri);
            return { ...f, portfolio: next };
          });
        },
      },
    });
  };

  const save = () => {
    if (!canSave) return;
    const place = form.area === WHOLE_KOMMUNE ? form.kom : form.area;
    update.mutate(
      {
        displayName: form.dn.trim(),
        presentation: form.bio.trim(),
        municipality: form.kom,
        place,
        homeNotes: form.notes.trim(),
        portfolio: form.portfolio,
        ...(form.avatarPath !== undefined ? { avatarPath: form.avatarPath } : {}),
      },
      {
        onSuccess: () => {
          haptics.success();
          const next = { ...form, avatarPath: undefined };
          setBase(next);
          setForm(next);
          setPreview(undefined);
          toast.success(nb.editProfile.saved, { bottom: 150 });
        },
        onError: () => toast.error(nb.toast.genericError, { bottom: 150 }),
      },
    );
  };

  const tiles: ({ kind: 'photo'; uri: string; i: number } | { kind: 'add' })[] = [
    ...form.portfolio.map((uri, i) => ({ kind: 'photo' as const, uri, i })),
    ...(form.portfolio.length < PORT_MAX ? [{ kind: 'add' as const }] : []),
  ];
  const rows = Array.from({ length: Math.ceil(tiles.length / 3) }, (_, r) => tiles.slice(r * 3, r * 3 + 3));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        scroll
        spacer="foot"
        header={<SubHeader title={nb.editProfile.title} onBack={back} />}
        scrollProps={{ keyboardShouldPersistTaps: 'handled' }}
        footer={
          <StickyFooter>
            <View style={styles.status}>
              {dirty && !update.isPending ? (
                <FadeInView style={styles.statusL}>
                  <View style={styles.dirtyDot} />
                  <Text style={styles.dirtyText}>{nb.editProfile.dirty}</Text>
                </FadeInView>
              ) : !update.isPending ? (
                <View style={styles.statusL}>
                  <Icon name="check" size={14} color={colors.ok} />
                  <Text style={[text.meta, styles.f125]}>{nb.editProfile.clean}</Text>
                </View>
              ) : (
                <View />
              )}
              {dirty && !update.isPending ? (
                <TextLink
                  label={nb.editProfile.discard}
                  icon={null}
                  onPress={() => {
                    setForm(base);
                    setPreview(undefined);
                  }}
                  style={styles.discard}
                />
              ) : null}
            </View>
            <Button
              label={update.isPending ? nb.editProfile.saving : nb.editProfile.save}
              variant="ink"
              size="lg"
              loading={update.isPending}
              disabled={!canSave && !update.isPending}
              onPress={save}
            />
          </StickyFooter>
        }
      >
        {/* avatar */}
        <ScaleIn style={styles.avWrap}>
          <View>
            <Avatar initials={profile.initials} uri={avatarUri} size={88} me={!avatarUri} seed={profile.id} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nb.editProfile.changePhoto}
              onPress={() => setPhotoOpen(true)}
              disabled={busy === 'avatar'}
              style={[styles.camBtn, shadow.medium]}
            >
              {busy === 'avatar' ? <Spinner size={18} color={colors.ink} /> : <Icon name="camera" size={18} color={colors.ink} />}
            </Pressable>
          </View>
          {photoNote ? <Text style={[text.meta, styles.mt16]}>{photoNote}</Text> : null}
        </ScaleIn>

        <View style={[styles.px, styles.stack14, styles.mt20]}>
          {/* identity */}
          <FadeUp delay={60} style={[styles.sec, shadow.card]}>
            <SecHead icon="user" bg={colors.cyanTint} fg={colors.cyanDeep} title={nb.editProfile.secName} />
            <Field
              label={nb.editProfile.fullName}
              labelRight={
                <View style={styles.lockchip}>
                  <Icon name="lock" size={14} color={colors.lockChipText} />
                  <Text style={styles.lockchipText}>{nb.editProfile.fromVipps}</Text>
                </View>
              }
              help={nb.editProfile.fullNameHelp}
            >
              <Input value={vipps?.name || profile.displayName} editable={false} accessibilityLabel={nb.editProfile.fullName} style={styles.locked} />
            </Field>
            <Field
              label={nb.editProfile.displayName}
              hint={nb.editProfile.displayNameHint}
              error={dnBad ? nb.editProfile.displayNameErr : null}
              help={nb.editProfile.displayNameTip}
            >
              <Input
                value={form.dn}
                onChangeText={(dn) => set({ dn })}
                placeholder={nb.editProfile.displayNamePh}
                maxLength={30}
                error={dnBad}
                accessibilityLabel={nb.editProfile.displayName}
              />
            </Field>
          </FadeUp>

          {/* about */}
          <FadeUp delay={100} style={[styles.sec, shadow.card]}>
            <SecHead icon="smile" bg={colors.limeTint} fg={colors.limeDeep} title={nb.editProfile.secAbout} />
            <Field label={nb.editProfile.bio} hint={nb.editProfile.bioHint}>
              <Input
                value={form.bio}
                onChangeText={(bio) => set({ bio })}
                multiline
                error={bioBad}
                style={styles.bio}
                accessibilityLabel={nb.editProfile.bio}
              />
              <View style={styles.between}>
                <Text style={[text.help, styles.flex]}>{nb.editProfile.bioHelp}</Text>
                <Text style={[styles.cnt, bioBad ? styles.cntErr : len > BIO_MAX - 40 ? styles.cntWarn : null]}>
                  {nb.editProfile.bioCount(len, BIO_MAX)}
                </Text>
              </View>
            </Field>
          </FadeUp>

          {/* location */}
          <FadeUp delay={140} style={[styles.sec, shadow.card]}>
            <SecHead icon="pin" bg={colors.limeTint} fg={colors.limeDeep} title={nb.editProfile.secWhere} />
            <Field label={nb.editProfile.kommune}>
              <SelectBox value={form.kom} onPress={() => setKomOpen(true)} accessibilityLabel={`${nb.editProfile.kommune}: ${form.kom}`} />
            </Field>
            <Field label={nb.editProfile.area} hint={nb.editProfile.areaHint}>
              <View style={styles.wrap8}>
                {areas.map((a) => (
                  <Chip key={a} size="sm" label={a} selected={form.area === a} onPress={() => set({ area: a })} />
                ))}
              </View>
              <View style={styles.seen}>
                <View style={styles.areaDot}>
                  <View style={styles.areaCenter} />
                </View>
                <Text style={styles.seenText}>
                  {nb.editProfile.areaSeenPre}
                  <Text style={styles.bold}>{placeLabel}</Text>
                  {nb.editProfile.areaSeenPost}
                </Text>
              </View>
            </Field>
          </FadeUp>

          {/* home notes */}
          <FadeUp delay={180} style={[styles.sec, shadow.card]}>
            <View style={styles.between}>
              <SecHead icon="key" bg={colors.ink} fg={colors.lime} title={nb.editProfile.secNotes} />
              <Pill label={nb.editProfile.private} tone="dark" icon="lock" size="sm" />
            </View>
            <View style={styles.field}>
              <Text style={styles.notesLabel}>{nb.editProfile.notesLabel}</Text>
              <Input
                value={form.notes}
                onChangeText={(notes) => set({ notes })}
                multiline
                placeholder={nb.editProfile.notesPh}
                style={styles.notes}
                accessibilityLabel={nb.editProfile.secNotes}
              />
            </View>
            <Note icon="shield">{nb.editProfile.notesNote}</Note>
          </FadeUp>

          {/* portfolio */}
          <FadeUp delay={220} style={[styles.sec, shadow.card]}>
            <View style={styles.between}>
              <SecHead icon="image" bg={categoryColors.maling.bg} fg={categoryColors.maling.fg} title={nb.editProfile.secPortfolio} />
              <Text style={text.meta}>{nb.editProfile.portCount(form.portfolio.length, PORT_MAX)}</Text>
            </View>
            <View style={styles.grid}>
              {rows.map((row, r) => (
                <View key={r} style={styles.gridRow}>
                  {[0, 1, 2].map((c) => {
                    const t = row[c];
                    if (!t) return <View key={c} style={styles.cell} />;
                    if (t.kind === 'add') {
                      return (
                        <PressableScale
                          key="add"
                          accessibilityRole="button"
                          accessibilityLabel={nb.editProfile.portAddAria}
                          onPress={addPortfolio}
                          disabled={busy === 'port'}
                          style={[styles.cell, styles.add]}
                        >
                          <View style={styles.addIcon}>
                            {busy === 'port' ? <Spinner size={16} color={colors.ink} /> : <Icon name="plus" size={18} color={colors.ink} />}
                          </View>
                          <Text style={styles.addText}>{nb.editProfile.portAdd}</Text>
                        </PressableScale>
                      );
                    }
                    return (
                      <ScaleIn key={t.uri} style={styles.cell}>
                        <View style={styles.ptl}>
                          <Image source={{ uri: t.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={nb.editProfile.portRemoveAria(t.i + 1)}
                          onPress={() => removePortfolio(t.uri)}
                          hitSlop={7}
                          style={styles.rm}
                        >
                          <Icon name="x" size={14} color={colors.white} />
                        </Pressable>
                      </ScaleIn>
                    );
                  })}
                </View>
              ))}
            </View>
            <Text style={text.help}>{nb.editProfile.portHelp}</Text>
          </FadeUp>
        </View>
      </Screen>

      <Sheet visible={photoOpen} onClose={() => setPhotoOpen(false)} title={nb.editProfile.photoSheetTitle} titleSize="h2">
        <Text style={[text.meta, styles.sheetSub]}>{nb.editProfile.photoSheetSub}</Text>
        <View style={styles.stack8}>
          <PickRow icon="camera" bg={colors.limeTint} fg={colors.limeDeep} label={nb.editProfile.takePhoto} onPress={() => pickAvatar('camera')} />
          <PickRow icon="image" bg={colors.cyanTint} fg={colors.cyanDeep} label={nb.editProfile.pickAlbum} onPress={() => pickAvatar('library')} />
          {avatarUri ? (
            <PickRow icon="trash" bg={colors.dangerTint} fg={colors.danger} label={nb.editProfile.removePhoto} onPress={removeAvatar} danger />
          ) : null}
        </View>
      </Sheet>

      <Sheet visible={komOpen} onClose={() => setKomOpen(false)} title={nb.editProfile.pickKommune} scroll heightRatio={0.7}>
        {INNLANDET_KOMMUNER.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: form.kom === k }}
            onPress={() => {
              if (k !== form.kom) set({ kom: k, area: profileAreas(k)[0] });
              setKomOpen(false);
            }}
            style={styles.komRow}
          >
            <Text style={[text.body, styles.flex]}>{k}</Text>
            <Radio selected={form.kom === k} />
          </Pressable>
        ))}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function SecHead({ icon, bg, fg, title }: { icon: IconName; bg: string; fg: string; title: string }) {
  return (
    <View style={styles.secH}>
      <View style={[styles.secIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={16} color={fg} />
      </View>
      <Text style={styles.secTitle} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

function PickRow({ icon, bg, fg, label, onPress, danger }: { icon: IconName; bg: string; fg: string; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.pickrow}>
      <View style={[styles.pickIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={18} color={fg} />
      </View>
      <Text style={[styles.pickText, danger && { color: colors.danger }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  mt16: { marginTop: 16 },
  mt20: { marginTop: 20 },
  f125: { fontSize: 12.5 },
  bold: { fontFamily: fonts.bodyBold, color: colors.ink },
  stack8: { gap: 8 },
  stack14: { gap: 14 },
  wrap8: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  field: { gap: 8 },
  avWrap: { alignItems: 'center', paddingTop: 10, paddingHorizontal: screenPadding },
  camBtn: {
    position: 'absolute',
    right: -8,
    bottom: -6,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lime,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sec: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 18 },
  secH: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  secTitle: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 19, color: colors.ink },
  lockchip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.vippsIdBg,
  },
  lockchipText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.lockChipText },
  locked: { backgroundColor: colors.surface2, color: colors.ink2, borderStyle: 'dashed' },
  bio: { minHeight: 140 },
  notes: { minHeight: 104 },
  cnt: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.mute, textAlign: 'right' },
  cntWarn: { color: colors.warn },
  cntErr: { color: colors.danger },
  seen: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.m, backgroundColor: colors.surface2, marginTop: 4 },
  areaDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.wizardRing,
    borderWidth: 1.5,
    borderColor: colors.areaBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaCenter: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink },
  seenText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18.9, color: colors.ink2 },
  notesLabel: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 16, color: colors.mute },
  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1, aspectRatio: 1 },
  ptl: { flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.track },
  rm: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  add: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.mute },
  status: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 18 },
  statusL: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dirtyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.star },
  dirtyText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.warn },
  discard: { minHeight: 28 },
  sheetSub: { marginTop: -6, marginBottom: 16 },
  pickrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface2,
    minHeight: 56,
  },
  pickIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pickText: { fontFamily: fonts.bodySemi, fontSize: 15.5, color: colors.ink },
  komRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line2 },
});
