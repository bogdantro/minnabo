import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Listing } from '@/domain/types';
import { editListingHref, isOpenListing } from '@/domain/editing';
import { useCloseHelperSlots, useHelperSlots } from '@/api/queries';
import { serverMessage } from '@/lib/errors';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';
import nb from '@/i18n/nb';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button, FadeUp, Icon, Pill, ScaleIn, type IconKey } from '@/components/ui';

/** No tilbud after this long: the tips show on the owner's page too, not only from the push. */
const TIPS_AFTER_MS = 48 * 60 * 60 * 1000;
const BOTTOM = 170;

function Card({ icon, tint, iconColor, title, body, children }: { icon: IconKey; tint: string; iconColor: string; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <ScaleIn style={[styles.card, shadow.card]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: tint }]}>
          <Icon name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.flex}>
          <Text style={[text.label, styles.title]}>{title}</Text>
          {body ? <Text style={text.meta}>{body}</Text> : null}
        </View>
      </View>
      {children}
    </ScaleIn>
  );
}

/** «Ingen tilbud ennå»: what usually helps. Shows after 48 hours, or when the push opened the page. */
export function NoOffersTips({ listing, offers, force }: { listing: Listing; offers: number; force: boolean }) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const old = now - Date.parse(listing.createdAt) >= TIPS_AFTER_MS;
  if (offers > 0 || !isOpenListing(listing.status) || !(old || force)) return null;
  const tips: { icon: IconKey; text: string }[] = [
    ...(listing.images.length ? [] : [{ icon: 'image' as const, text: nb.noOffers.photo }]),
    { icon: 'tag', text: nb.noOffers.price },
    { icon: 'zap', text: nb.noOffers.urgent },
    { icon: 'share', text: nb.noOffers.share },
  ];
  return (
    <Card icon="sparkle" tint={colors.limeTint} iconColor={colors.limeDeep} title={nb.noOffers.title} body={nb.noOffers.body}>
      <View style={styles.tips}>
        {tips.map((t) => (
          <View key={t.text} style={styles.tip}>
            <Icon name={t.icon} size={16} color={colors.limeDeep} />
            <Text style={[text.meta, styles.flex, styles.tipText]}>{t.text}</Text>
          </View>
        ))}
      </View>
      <Button label={nb.noOffers.edit} icon="edit" variant="ink" size="sm" onPress={() => router.push(editListingHref(listing.id))} />
    </Card>
  );
}

/** «1 av 2 hjelpere»: for the owner with the way out, for the others as a plain pill. */
export function HelperSlotsCard({ listing, isOwner }: { listing: Listing; isOwner: boolean }) {
  const multi = (listing.helpersNeeded ?? 1) > 1;
  const slots = useHelperSlots(listing.id, multi).data;
  const close = useCloseHelperSlots(listing.id);
  if (!multi || !slots) return null;
  if (!isOwner) {
    return (
      <FadeUp>
        <Pill label={nb.helpers.pill(slots.needed - slots.taken)} tone="accent" icon="users" />
      </FadeUp>
    );
  }
  const askClose = async () => {
    const ok = await confirm({ title: nb.helpers.closeTitle, message: nb.helpers.closeBody, confirmLabel: nb.helpers.closeConfirm });
    if (ok) close.mutate(undefined, { onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: BOTTOM }) });
  };
  return (
    <Card icon="users" tint={colors.cyanTint} iconColor={colors.cyanDeep} title={nb.helpers.title(slots.taken, slots.needed)} body={nb.helpers.body}>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
        {Array.from({ length: slots.needed }, (_, i) => (
          <View key={i} style={[styles.dot, i < slots.taken && styles.dotOn]}>
            {i < slots.taken ? <Icon name="check" size={13} color={colors.ink} /> : null}
          </View>
        ))}
      </View>
      {slots.taken > 0 && slots.taken < slots.needed ? (
        <Button label={nb.helpers.close} variant="ghost" size="sm" loading={close.isPending} onPress={() => void askClose()} />
      ) : null}
    </Card>
  );
}

/** The owner sees that the head start is running; a followed helper sees why they got it first. */
export function FirstRefusalNote({ listing, isOwner, ownerFirst }: { listing: Listing; isOwner: boolean; ownerFirst: string }) {
  const [now] = useState(() => Date.now());
  if (!listing.firstToFollowedUntil || Date.parse(listing.firstToFollowedUntil) <= now) return null;
  return (
    <View style={styles.first}>
      <Icon name="star" size={15} color={colors.limeDeep} />
      <Text style={[text.meta, styles.flex, styles.firstText]}>{isOwner ? nb.firstRefusal.owner : nb.firstRefusal.helper(ownerFirst)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, flexBasis: 0 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15.5, marginBottom: 2 },
  row: { flexDirection: 'row', gap: 8 },
  tips: { gap: 9 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipText: { color: colors.ink2 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.lime },
  first: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.m, backgroundColor: colors.limeTint },
  firstText: { color: colors.limeDeep },
});
