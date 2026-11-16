import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { Listing } from '@/domain/types';
import { useJoinShared, useSharedJoiners } from '@/api/communityQueries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { isOpenListing } from '@/domain/editing';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Button, Icon, Input } from '@/components/ui';

const NOTE_MAX = 120;

/**
 * «Flere innkjørsler i samme gate» (0108): on a snømåking / hage oppdrag the owner shared, neighbours in the
 * same kommune join so one helper takes several driveways. The owner and helpers see who and where (roughly);
 * everyone else sees how many. Prices are agreed with each neighbour directly.
 */
export function SharedStreetCard({ listing, isOwner }: { listing: Listing; isOwner: boolean }) {
  const me = useCurrentUser();
  const joiners = useSharedJoiners(listing.id, !!listing.sharedStreet).data;
  const join = useJoinShared(listing.id);
  const [note, setNote] = useState('');
  if (!listing.sharedStreet) return null;
  const count = joiners?.count ?? 0;
  const mine = !!joiners?.mine;
  const canJoin = !isOwner && !!me.id && !me.isYouth && isOpenListing(listing.status) && me.municipality === listing.location.municipality;

  const toggle = (on: boolean) =>
    join.mutate(
      { join: on, note: note.trim() },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(on ? nb.felles.shared.joined : nb.felles.shared.left);
          setNote('');
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );

  return (
    <View style={styles.card} testID="shared-street">
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon name="users" size={18} color={colors.limeDeep} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{nb.felles.shared.title}</Text>
          <Text style={text.meta}>{count ? nb.felles.shared.count(count) : nb.felles.shared.none}</Text>
        </View>
      </View>
      {joiners?.people.length ? (
        <View style={styles.people}>
          {joiners.people.map((p, i) => (
            <View key={`${p.name}-${i}`} style={styles.person}>
              <Icon name="home" size={14} color={colors.ink2} />
              <Text style={styles.personText} numberOfLines={1}>
                {p.note ? `${p.name} · ${p.note}` : p.name}
              </Text>
            </View>
          ))}
          <Text style={text.hint}>{nb.felles.shared.helperNote}</Text>
        </View>
      ) : null}
      {mine ? (
        <Button label={nb.felles.shared.leave} variant="ghost" size="sm" icon="x" loading={join.isPending} onPress={() => toggle(false)} />
      ) : canJoin ? (
        <View style={styles.joinBox}>
          <Text style={styles.joinTitle}>{nb.felles.shared.joinTitle}</Text>
          <Text style={[text.meta, styles.mb8]}>{nb.felles.shared.joinBody}</Text>
          <Input
            value={note}
            onChangeText={setNote}
            maxLength={NOTE_MAX}
            placeholder={nb.felles.shared.notePh}
            accessibilityLabel={nb.felles.shared.noteLabel}
          />
          <Button label={nb.felles.shared.join} variant="lime" size="md" icon="plus" loading={join.isPending} onPress={() => toggle(true)} style={styles.mt10} />
        </View>
      ) : !isOwner && me.isYouth ? (
        <Text style={text.hint}>{nb.felles.shared.youthNo}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line2, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, color: colors.ink },
  people: { gap: 6 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  joinBox: { padding: 14, borderRadius: radius.m, backgroundColor: colors.surface2 },
  joinTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink, marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mt10: { marginTop: 10 },
});
