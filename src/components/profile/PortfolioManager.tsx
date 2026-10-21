import { useState } from 'react';
import { serverMessage } from '@/lib/errors';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useAddPortfolioItem, usePortfolio, useRemovePortfolioItem } from '@/api/queries';
import { confirm } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { pickAndUpload } from '@/lib/uploads';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Button, ErrorText, Field, Icon, Input, PressableScale, ScaleIn, Sheet, Spinner } from '@/components/ui';

export const PORTFOLIO_MAX = 9;
const t = nb.editProfile;

type Shot = { path: string; uri: string };

/**
 * Rediger profil → Portefølje (design/screens/RedigerProfil.dc.html): labelled tiles
 * + "Legg til". Each tile is one job with an "etter" photo and, when there is one,
 * a "før" photo – what Profil shows as before / after. Saved right away.
 */
export function PortfolioManager({ userId }: { userId: string }) {
  const { data } = usePortfolio(userId || undefined);
  const add = useAddPortfolioItem();
  const remove = useRemovePortfolioItem();
  const items = data ?? [];
  const [open, setOpen] = useState(false);

  const del = async (id: string, title: string) => {
    const ok = await confirm({ title: t.portRemoveConfirm(title), destructive: true, confirmLabel: t.portRemove });
    if (!ok) return;
    haptics.light();
    remove.mutate(id, {
      onSuccess: () => toast.success(t.portRemoved, { icon: 'trash', bottom: 150 }),
      onError: () => toast.error(nb.toast.genericError, { bottom: 150 }),
    });
  };

  const tiles: ({ kind: 'item'; i: number } | { kind: 'add' })[] = [
    ...items.map((_, i) => ({ kind: 'item' as const, i })),
    ...(items.length < PORTFOLIO_MAX ? [{ kind: 'add' as const }] : []),
  ];
  const rows = Array.from({ length: Math.ceil(tiles.length / 3) }, (_, r) => tiles.slice(r * 3, r * 3 + 3));

  return (
    <>
      <Text style={[text.meta, styles.count]}>{t.portCount(items.length, PORTFOLIO_MAX)}</Text>
      <View style={styles.grid}>
        {rows.map((row, r) => (
          <View key={r} style={styles.gridRow}>
            {[0, 1, 2].map((c) => {
              const tile = row[c];
              if (!tile) return <View key={c} style={styles.cell} />;
              if (tile.kind === 'add') {
                return (
                  <PressableScale key="add" accessibilityRole="button" accessibilityLabel={t.portAddAria} onPress={() => setOpen(true)} style={[styles.cell, styles.add]}>
                    <View style={styles.addIcon}>
                      <Icon name="plus" size={18} color={colors.ink} />
                    </View>
                    <Text style={styles.addText}>{t.portAdd}</Text>
                  </PressableScale>
                );
              }
              const item = items[tile.i];
              return (
                <ScaleIn key={item.id} style={styles.cell}>
                  <View style={styles.ptl}>
                    <Image source={{ uri: item.afterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                    <Text style={styles.label} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={t.portRemoveTitle(item.title)} onPress={() => void del(item.id, item.title)} hitSlop={7} style={styles.rm}>
                    <Icon name="x" size={14} color={colors.white} />
                  </Pressable>
                </ScaleIn>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={text.help}>{t.portHelp}</Text>

      <AddSheet
        visible={open}
        userId={userId}
        saving={add.isPending}
        onClose={() => setOpen(false)}
        onSave={(input) =>
          add.mutate(input, {
            onSuccess: () => {
              setOpen(false);
              haptics.success();
              toast.success(t.portAdded, { icon: 'image', bottom: 150 });
            },
            onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
          })
        }
      />
    </>
  );
}

function AddSheet({
  visible,
  userId,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  userId: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: { title: string; afterPath: string; beforePath?: string; place?: string; caption?: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [caption, setCaption] = useState('');
  const [before, setBefore] = useState<Shot | null>(null);
  const [after, setAfter] = useState<Shot | null>(null);
  const [busy, setBusy] = useState<'before' | 'after' | null>(null);
  const [tried, setTried] = useState(0);

  const pick = async (which: 'before' | 'after') => {
    if (busy || !userId) return;
    setBusy(which);
    try {
      const res = await pickAndUpload({ bucket: 'listing-images', folder: userId, source: 'library' });
      if (res) (which === 'before' ? setBefore : setAfter)({ path: res.publicUrl, uri: res.localUri ?? res.publicUrl });
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError));
    } finally {
      setBusy(null);
    }
  };

  const titleOk = title.trim().length >= 3;
  const save = () => {
    if (!titleOk || !after) {
      setTried((n) => n + 1);
      haptics.warning();
      return;
    }
    onSave({ title: title.trim(), afterPath: after.path, beforePath: before?.path, place: place.trim() || undefined, caption: caption.trim() || undefined });
    setTitle('');
    setPlace('');
    setCaption('');
    setBefore(null);
    setAfter(null);
    setTried(0);
  };

  const slot = (which: 'before' | 'after', shot: Shot | null, label: string, hint: string) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={shot ? t.portChange(label) : t.portPick(label)}
      onPress={() => void pick(which)}
      style={[styles.slot, tried > 0 && which === 'after' && !after && styles.slotErr]}
    >
      {shot ? <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
      {busy === which ? <Spinner size={18} color={colors.ink} /> : !shot ? <Icon name="image" size={22} color={colors.ink2} /> : null}
      <View style={[styles.slotLab, shot && styles.slotLabOn]}>
        <Text style={[styles.slotLabText, shot && { color: colors.white }]}>{label}</Text>
      </View>
      {!shot ? <Text style={styles.slotHint}>{hint}</Text> : null}
    </PressableScale>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={t.portSheetTitle} titleSize="h2" scroll>
      <View style={styles.slots}>
        {slot('before', before, nb.profile.before, t.optional)}
        {slot('after', after, nb.profile.after, t.portRequired)}
      </View>
      {tried > 0 && !after ? <ErrorText shakeKey={tried}>{t.portAfterErr}</ErrorText> : null}
      <Field label={t.portTitle} style={styles.mt16}>
        <Input value={title} onChangeText={(v) => setTitle(v.slice(0, 40))} placeholder={t.portTitlePh} error={tried > 0 && !titleOk} accessibilityLabel={t.portTitle} />
        {tried > 0 && !titleOk ? <ErrorText shakeKey={tried}>{t.portTitleErr}</ErrorText> : null}
      </Field>
      <Field label={t.portPlace} hint={t.optional} style={styles.mt16}>
        <Input value={place} onChangeText={(v) => setPlace(v.slice(0, 40))} placeholder={t.portPlacePh} accessibilityLabel={t.portPlace} />
      </Field>
      <Field label={t.portCaption} hint={t.optional} style={styles.mt16}>
        <Input value={caption} onChangeText={(v) => setCaption(v.slice(0, 240))} placeholder={t.portCaptionPh} multiline style={styles.caption} accessibilityLabel={t.portCaption} />
      </Field>
      <Button label={t.portSave} icon="plus" size="lg" loading={saving} disabled={!!busy} onPress={save} style={styles.mt18} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  count: { position: 'absolute', right: 0, top: 6 },
  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1, aspectRatio: 1 },
  ptl: { flex: 1, borderRadius: radius.tile, overflow: 'hidden', backgroundColor: colors.track, justifyContent: 'flex-end' },
  label: {
    alignSelf: 'flex-start',
    margin: 6,
    paddingHorizontal: 7,
    height: 20,
    lineHeight: 20,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.scrim,
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  rm: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    borderRadius: radius.tile,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink2 },
  slots: { flexDirection: 'row', gap: 12 },
  slot: {
    flex: 1,
    height: 132,
    borderRadius: radius.tile,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  slotErr: { borderColor: colors.danger },
  slotLab: { position: 'absolute', top: 8, left: 8, height: 20, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.neutralPill, justifyContent: 'center' },
  slotLabOn: { backgroundColor: colors.ink },
  slotLabText: { fontFamily: fonts.bodyHeavy, fontSize: 10.5, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.ink2 },
  slotHint: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.mute },
  caption: { minHeight: 96 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
});
