import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LendCategory, LendItem } from '@/domain/types';
import nb from '@/i18n/nb';
import { useLendItem, useMyNabolag, useSaveLendItem } from '@/api/queries';
import { LEND_ART, LEND_CATEGORIES } from '@/domain/lend';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { pickAndUpload } from '@/lib/uploads';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Button, CategoryArt, ErrorText, Field, Icon, Input, Spinner, Sheet, Toggle } from '@/components/ui';
import { Image } from '@/components/ui/Image';

const TITLE_MAX = 60;
const NOTE_MAX = 300;

/**
 * «Lån ut noe» / «Endre tingen»: a big photo, a name, the kind as tiles, a line about it, who can borrow it;
 * visible or hidden when editing. The one form for lending out, on Utlån and on Oppslagstavla alike (0107).
 */
export function LendItemForm({
  item,
  userId,
  kommune,
  startTitle,
  onClose,
}: {
  item?: LendItem;
  userId: string;
  /** «Hele Lillehammer» */
  kommune?: string;
  /** typed on the board before «Lån ut» was picked */
  startTitle?: string;
  onClose: () => void;
}) {
  const t = nb.lend;
  const save = useSaveLendItem();
  const myNabolag = useMyNabolag(!item && !!userId).data ?? [];
  // who can borrow it: null = the whole kommune, or one of my nabolag; chosen once, like an oppslag
  const [audience, setAudience] = useState<string | null>(null);
  const [title, setTitle] = useState(item?.title ?? startTitle ?? '');
  const [category, setCategory] = useState<LendCategory>(item?.category ?? 'VERKTOY');
  const [note, setNote] = useState(item?.note ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(item?.imagePath ? { path: item.imagePath, url: item.imageUrl ?? '' } : null);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const bad = title.trim().length < 3;

  const addPhoto = async () => {
    if (busy || !userId) return;
    setBusy(true);
    try {
      const r = await pickAndUpload({ bucket: 'listing-images', folder: userId, source: 'library' });
      if (r) setPhoto({ path: r.path, url: r.publicUrl });
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError));
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    if (bad) {
      setTried(true);
      haptics.warning();
      return;
    }
    save.mutate(
      { id: item?.id, title, category, note, imagePath: photo?.path ?? null, active, neighbourhoodId: item ? undefined : audience },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(item ? t.saved : t.published, { icon: 'check' });
          onClose();
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
  };

  return (
    <Sheet
      visible
      onClose={() => !save.isPending && onClose()}
      title={item ? t.formTitleEdit : t.formTitleNew}
      titleSize="h2"
      subtitle={item ? undefined : t.formSub}
      scroll
      heightRatio={0.92}
      footer={<Button label={item ? t.save : t.publish} icon={item ? 'check' : 'send'} size="lg" loading={save.isPending} onPress={submit} />}
    >
      <View style={styles.form}>
        {/* the photo first: things with a photo are borrowed more */}
        {photo ? (
          <View style={styles.photo}>
            <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
            <View style={styles.photoBtns}>
              <Pressable accessibilityRole="button" accessibilityLabel={t.changePhoto} onPress={addPhoto} style={styles.photoBtn}>
                {busy ? <Spinner size={16} color={colors.ink} /> : <Icon name="image" size={16} color={colors.ink} />}
                <Text style={styles.photoBtnText}>{t.changePhoto}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t.removePhoto} onPress={() => setPhoto(null)} style={[styles.photoBtn, styles.photoBtnRound]}>
                <Icon name="trash" size={16} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={t.addPhoto} onPress={addPhoto} style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}>
            <View style={styles.addRing} />
            <View style={styles.addDisc}>{busy ? <Spinner size={22} color={colors.ink} /> : <Icon name="camera" size={26} color={colors.ink} />}</View>
            <Text style={styles.addTitle}>{t.addPhoto}</Text>
            <Text style={text.meta}>{t.addPhotoSub}</Text>
          </Pressable>
        )}

        <Field label={t.name} hint={`${title.length}/${TITLE_MAX}`}>
          <Input value={title} onChangeText={setTitle} placeholder={t.namePh} maxLength={TITLE_MAX} accessibilityLabel={t.name} />
        </Field>
        {tried && bad ? <ErrorText>{t.nameErr}</ErrorText> : null}

        <Text style={text.label}>{t.category}</Text>
        <View style={styles.grid} accessibilityRole="radiogroup">
          {LEND_CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.cats[c]}
                onPress={() => {
                  haptics.select();
                  setCategory(c);
                }}
                style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && styles.pressed]}
              >
                <CategoryArt category={LEND_ART[c]} width={46} height={46} radius={23} iconSize={22} />
                <Text style={[styles.tileText, on && styles.tileTextOn]}>{t.cats[c]}</Text>
                {on ? (
                  <View style={styles.tick}>
                    <Icon name="check" size={12} color={colors.lime} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Field label={t.desc} hint={`${note.length}/${NOTE_MAX}`}>
          <Input value={note} onChangeText={setNote} placeholder={t.descPh} maxLength={NOTE_MAX} multiline accessibilityLabel={t.desc} />
        </Field>

        {!item && myNabolag.length ? (
          <View style={styles.gap8}>
            <Text style={text.label}>{t.audienceLabel}</Text>
            <View style={styles.audience} accessibilityRole="radiogroup" accessibilityLabel={t.audienceLabel}>
              {[null, ...myNabolag].map((n) => {
                const on = (n?.id ?? null) === audience;
                const label = n ? nb.noticeboard.audienceNabolag(n.place) : nb.noticeboard.audienceAll(kommune || nb.lend.title);
                return (
                  <Pressable
                    key={n?.id ?? 'all'}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={label}
                    onPress={() => {
                      haptics.select();
                      setAudience(n?.id ?? null);
                    }}
                    style={({ pressed }) => [styles.aud, on && styles.audOn, pressed && styles.pressed]}
                  >
                    <Icon name={n ? 'home' : 'globe'} size={15} color={on ? colors.white : colors.ink2} />
                    <Text style={[styles.audText, on && styles.audTextOn]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {item ? (
          <View style={styles.visible}>
            <View style={styles.flex}>
              <Text style={text.label}>{t.visible}</Text>
              <Text style={text.meta}>{active ? t.visibleOn : t.visibleOff}</Text>
            </View>
            <Toggle value={active} onValueChange={setActive} accessibilityLabel={t.visible} />
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { opacity: 0.8 },
  photo: { height: 200, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.bg },
  photoBtns: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.white },
  photoBtnRound: { width: 40, paddingHorizontal: 0, justifyContent: 'center' },
  photoBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  addPhoto: {
    height: 180,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.limeDeep,
    backgroundColor: colors.limeTint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  addRing: { position: 'absolute', top: 18, width: 92, height: 92, borderRadius: 46, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lime },
  addDisc: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white, marginBottom: 4 },
  addTitle: { ...text.label, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  tileOn: { borderColor: colors.ink, backgroundColor: colors.limeTint },
  tileText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink2 },
  tileTextOn: { color: colors.ink, fontFamily: fonts.bodyBold },
  tick: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  visible: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface2 },
  gap8: { gap: 8 },
  audience: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aud: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  audOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  audText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.ink2 },
  audTextOn: { color: colors.white },
});

/** Edit the thing behind a «Lån ut» oppslag from the board: the same form, once the thing is loaded. */
export function LendItemFormById({ id, userId, onClose }: { id: string; userId: string; onClose: () => void }) {
  const item = useLendItem(id);
  if (item.isLoading) return null;
  if (!item.data) {
    onClose();
    return null;
  }
  return <LendItemForm item={item.data} userId={userId} onClose={onClose} />;
}
