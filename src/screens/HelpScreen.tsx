import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Button, FadeUp, Icon, Screen, SearchField, SubHeader } from '@/components/ui';
import { ExpandableSection } from '@/components/ui/ExpandableSection';

/** Hjelp og vanlige spørsmål. «Kontakt oss» opens the thread with MinNabo in Innboks. */
export function HelpScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const groups = nb.help.groups
    // a youth account doesn't post oppdrag: those answers would only confuse
    .filter((g) => !(me.isYouth && g.adultsOnly))
    .map((g) => ({ ...g, items: g.items.filter((i) => !needle || `${i.q} ${i.a}`.toLowerCase().includes(needle)) }))
    .filter((g) => g.items.length);
  return (
    <Screen
      scroll
      spacer="none"
      header={<SubHeader title={nb.help.title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
    >
      <FadeUp style={[styles.px, styles.head]}>
        <Text style={text.h1} accessibilityRole="header">
          {nb.help.heading}
        </Text>
        <SearchField value={q} onChangeText={setQ} placeholder={nb.help.searchPh} />
      </FadeUp>

      <View style={[styles.px, styles.list]}>
        {groups.length ? (
          groups.map((g, i) => (
            <FadeUp key={g.title} delay={Math.min(i, 5) * 50} style={styles.group}>
              <Text style={text.eyebrow}>{g.title}</Text>
              {g.items.map((item) => (
                <ExpandableSection key={item.q} title={item.q}>
                  <Text style={styles.answer}>{item.a}</Text>
                </ExpandableSection>
              ))}
            </FadeUp>
          ))
        ) : (
          <FadeUp style={styles.none}>
            <View style={styles.noneIcon}>
              <Icon name="search" size={22} color={colors.cyanDeep} />
            </View>
            <Text style={[text.label, styles.center]}>{nb.help.noHits}</Text>
            <Text style={[text.meta, styles.center]}>{nb.help.noHitsSub}</Text>
          </FadeUp>
        )}

        <FadeUp delay={200} style={[styles.contact, shadow.card]}>
          <View style={styles.contactIcon}>
            <Icon name="msg" size={20} color={colors.ink} />
          </View>
          <Text style={[text.h3, styles.white]}>{nb.help.contactTitle}</Text>
          <Text style={[text.body, styles.contactBody]}>{nb.help.contactBody}</Text>
          <Button label={nb.help.contact} icon="send" onPress={() => safePush('/minnabo')} />
        </FadeUp>
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  head: { paddingTop: 14, gap: 14 },
  list: { marginTop: 20, gap: 20 },
  group: { gap: 8 },
  answer: { ...text.body, color: colors.ink2 },
  center: { textAlign: 'center' },
  none: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  noneIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  contact: { backgroundColor: colors.ink, borderRadius: radius.listingCard, padding: 20, gap: 8 },
  contactIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  white: { color: colors.white },
  contactBody: { color: colors.onInk78, marginBottom: 8 },
  bottom: { height: 50 },
});
