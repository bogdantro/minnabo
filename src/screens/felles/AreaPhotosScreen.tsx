import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useAddAreaPhoto, useAreaPhotos, useLikeAreaPhoto } from '@/api/communityQueries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { pickAndUpload } from '@/lib/uploads';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Image } from '@/components/ui/Image';
import { Button, Field, Icon, Input, Note, Sheet } from '@/components/ui';
import { FellesPage, TONES } from '@/components/community/FellesPage';

/** «Ukas bilde»: this week's photos from the kommune, most hearts first; anyone can send in two a week. */
export function AreaPhotosScreen() {
  const me = useCurrentUser();
  const { municipality } = useLocationScope();
  const kommune = me.municipality || municipality || '';
  const photos = useAreaPhotos(kommune).data ?? [];
  const like = useLikeAreaPhoto(kommune);
  const add = useAddAreaPhoto(kommune);
  const [picked, setPicked] = useState<{ path: string; url: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    if (!me.id || busy) return;
    setBusy(true);
    try {
      const r = await pickAndUpload({ bucket: 'listing-images', folder: me.id, source: 'library' });
      if (r) setPicked({ path: r.path, url: r.publicUrl });
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError));
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    if (!picked) return;
    add.mutate(
      { path: picked.path, caption },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(nb.felles.photos.sent);
          setPicked(null);
          setCaption('');
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
  };

  return (
    <FellesPage
      title={nb.felles.photos.title}
      lead={nb.felles.photos.lead}
      icon="camera"
      tone={TONES.lavender}
      testID="area-photos"
      footer={<Button label={nb.felles.photos.add} variant="lime" icon="camera" loading={busy} onPress={pick} />}
    >
      {photos.length === 0 ? <Note icon="camera">{nb.felles.photos.empty}</Note> : null}
      {photos.map((p, i) => (
        <View key={p.id} style={[styles.card, shadow.card]}>
          <View style={styles.photo}>
            <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
            {i === 0 ? (
              <View style={styles.winner}>
                <Icon name="award" size={13} color={colors.ink} />
                <Text style={styles.winnerText}>{nb.felles.photos.winner}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.foot}>
            <View style={styles.flex}>
              {p.caption ? <Text style={styles.caption}>{p.caption}</Text> : null}
              <Text style={text.meta}>{nb.felles.photos.by(p.by)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: p.mine }}
              accessibilityLabel={`${nb.felles.photos.like}, ${nb.felles.photos.likes(p.likes)}`}
              onPress={() => {
                haptics.light();
                like.mutate(p.id);
              }}
              style={[styles.like, p.mine && styles.likeOn]}
            >
              <Icon name="heart" size={16} color={p.mine ? colors.heart : colors.ink2} filled={p.mine} />
              <Text style={styles.likeText}>{p.likes}</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Note icon="shield">{nb.felles.photos.rules}</Note>

      <Sheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={nb.felles.photos.add}
        footer={<Button label={nb.felles.photos.send} variant="lime" icon="send" loading={add.isPending} onPress={send} />}
      >
        {picked ? <Image source={{ uri: picked.url }} style={styles.preview} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
        <Field label={nb.felles.photos.captionLabel} style={styles.mt12}>
          <Input value={caption} onChangeText={setCaption} maxLength={80} placeholder={nb.felles.photos.captionPh} accessibilityLabel={nb.felles.photos.captionLabel} />
        </Field>
      </Sheet>
    </FellesPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt12: { marginTop: 12 },
  card: { borderRadius: radius.card, backgroundColor: colors.surface, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1.4, backgroundColor: colors.surface2 },
  winner: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', margin: 12, paddingHorizontal: 10, height: 28, borderRadius: radius.pill, backgroundColor: colors.lime },
  winnerText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  caption: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, minWidth: 64, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface2, justifyContent: 'center' },
  likeOn: { backgroundColor: colors.savedBg },
  likeText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  preview: { width: '100%', aspectRatio: 1.4, borderRadius: radius.tile },
});
