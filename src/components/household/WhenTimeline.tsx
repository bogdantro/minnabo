import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useProfile } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { householdDays, whoOf, type HouseholdAgreement } from '@/domain/household';
import { formatTime, shortDate } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { colors, fonts, shadow, text, type CategoryId } from '@/theme/theme';
import { Avatar, CategoryArt, FadeUp, Icon } from '@/components/ui';

/**
 * «Hvem kommer når»: both adults' coming avtaler by day, a time column and a line down the side.
 * Mine and ours open the avtale; the partner's are only shown (their avtale is between them and the helper).
 */
export function WhenTimeline({ list, partnerId, partnerFirst }: { list: HouseholdAgreement[]; partnerId: string; partnerFirst: string }) {
  const t = nb.household;
  const days = householdDays(list, { today: t.today, tomorrow: t.tomorrow, noTime: t.noTime, date: shortDate });
  return (
    <View style={styles.wrap}>
      {days.map((d, di) => (
        <View key={d.key} style={styles.day}>
          <View style={styles.dayHead}>
            <View style={[styles.dayDot, di === 0 && d.key !== 'no-time' ? styles.dayDotFirst : null]} />
            <Text style={styles.dayLabel}>{d.label}</Text>
          </View>
          {d.items.map((a, i) => (
            <FadeUp key={a.proposalId} delay={Math.min(di * 2 + i, 8) * 35}>
              <Row a={a} partnerId={partnerId} partnerFirst={partnerFirst} />
            </FadeUp>
          ))}
        </View>
      ))}
    </View>
  );
}

function Row({ a, partnerId, partnerFirst }: { a: HouseholdAgreement; partnerId: string; partnerFirst: string }) {
  const t = nb.household;
  const who = whoOf(a);
  const time = a.scheduledAt ? formatTime(a.scheduledAt) : null;
  const whoLabel = who === 'me' ? t.whoMe : who === 'both' ? t.whoBoth : partnerFirst;
  const when = a.scheduledAt ? `${shortDate(a.scheduledAt)} kl. ${formatTime(a.scheduledAt)}` : (a.scheduledText ?? t.noTime);
  const open = who !== 'partner';
  const body = (
    <View style={[styles.card, shadow.card, who === 'partner' ? null : styles.cardMine]}>
      <CategoryArt category={(a.categorySlug ?? 'annet') as CategoryId} width={44} height={44} radius={14} iconSize={20} />
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={2}>
          {a.title}
        </Text>
        <Text style={text.meta} numberOfLines={2}>
          {a.scheduledAt ? t.agreementWith(a.with) : [a.scheduledText, t.agreementWith(a.with)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <WhoBadge who={who} partnerId={partnerId} label={whoLabel} />
      {open ? <Icon name="right" size={16} color={colors.faint} /> : null}
    </View>
  );
  return (
    <View style={styles.row}>
      <Text style={styles.time}>{time ?? '–'}</Text>
      <View style={styles.rail}>
        <View style={[styles.node, who === 'me' ? styles.nodeMe : who === 'both' ? styles.nodeBoth : styles.nodePartner]} />
      </View>
      {open ? (
        <Pressable
          style={({ pressed }) => [styles.flex, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.agreementA11y(a.title, when, whoLabel, a.with)}
          onPress={() => safePush(`/avtale/${a.proposalId}`)}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.flex} accessible accessibilityLabel={t.agreementA11y(a.title, when, whoLabel, a.with)}>
          {body}
        </View>
      )}
    </View>
  );
}

/** Whose it is: my face, theirs, or both overlapping. Always with a word, never colour alone. */
function WhoBadge({ who, partnerId, label }: { who: 'me' | 'partner' | 'both'; partnerId: string; label: string }) {
  const me = useCurrentUser();
  const partner = useProfile(partnerId).data;
  const mine = <Avatar initials={me.initials} uri={me.avatarUrl} seed={me.id} size={22} ring={false} />;
  const theirs = <Avatar initials={partner?.initials ?? '·'} uri={partner?.avatarUrl} seed={partnerId} size={22} ring={false} />;
  return (
    <View style={styles.who} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.faces}>
        {who === 'partner' ? theirs : mine}
        {who === 'both' ? <View style={styles.second}>{theirs}</View> : null}
      </View>
      <Text style={styles.whoText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const RAIL = 18;

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  day: { gap: 8 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 46 },
  dayDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.line, marginLeft: (RAIL - 10) / 2 },
  dayDotFirst: { backgroundColor: colors.lime },
  dayLabel: { ...text.eyebrow, fontSize: 11.5, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 0 },
  time: { width: 46, paddingTop: 22, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink2 },
  rail: { width: RAIL, alignItems: 'center', marginRight: 8, borderLeftWidth: 0 },
  node: { marginTop: 24, width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: colors.white },
  nodeMe: { backgroundColor: colors.cyan2 },
  nodePartner: { backgroundColor: colors.limeDeep },
  nodeBoth: { backgroundColor: colors.ink },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 20, backgroundColor: colors.white },
  cardMine: { borderWidth: 1.5, borderColor: colors.cyanTint },
  title: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  who: { alignItems: 'center', gap: 3, maxWidth: 70 },
  faces: { flexDirection: 'row' },
  second: { marginLeft: -8, borderRadius: 12, borderWidth: 2, borderColor: colors.white },
  whoText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.mute },
});
