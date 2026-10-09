import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { openWebsite } from '@/config/links';
import { useVippsIdentity } from '@/auth/identity';
import { consentKeys } from '@/api/queries';
import { TERMS } from '@/content/terms';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/reporting';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  FadeUp,
  Icon,
  Pill,
  ScaleIn,
  Screen,
  StickyFooter,
  SubHeader,
  TextLink,
  VerifiedIcon,
} from '@/components/ui';

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.can}>
      <View style={[styles.canIcon, { backgroundColor: ok ? colors.okTint : colors.neutralPill }]}>
        <Icon name={ok ? 'check' : 'lock'} size={14} color={ok ? colors.ok : colors.mute} />
      </View>
      <Text style={[text.bodySemi, styles.canText, !ok && { color: colors.mute }]}>{label}</Text>
    </View>
  );
}

/** Onboarding · Ungdomskonto (design/screens/Ungdomskonto.dc.html) – shown when Vipps age < 18. */
export function YouthAccountScreen() {
  const router = useRouter();
  const id = useVippsIdentity();
  const qc = useQueryClient();
  const [checks, setChecks] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const ready = checks.every(Boolean);

  // The three boxes are the youth's consent: stored with a timestamp like an adult's
  // (Samtykke), and /ung does not open without it.
  const create = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('not signed in');
      const { error } = await supabase
        .from('consent_records')
        .insert({ profile_id: data.user.id, terms: true, privacy: true, age: true, tips: false });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: consentKeys.log });
      router.replace('/ung');
    } catch (e) {
      reportError(e, { where: 'YouthAccountScreen.create' });
      toast.error(nb.consent.saveFailed, { bottom: 150 });
    } finally {
      setBusy(false);
    }
  };

  // Only reached right after a Vipps login; the identity is still loading for a moment.
  if (!id) return <View style={styles.blank} />;

  return (
    <Screen
      scroll
      spacer="foot"
      header={
        <SubHeader
          title={nb.youth.title}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/logg-inn'))}
        />
      }
      contentStyle={styles.content}
      footer={
        <StickyFooter>
          {ready ? (
            <ScaleIn>
              <Button label={nb.youth.create} size="lg" iconRight="arrow" loading={busy} onPress={() => void create()} />
            </ScaleIn>
          ) : (
            <Button label={nb.youth.create} size="lg" disabled onPress={() => undefined} />
          )}
          <Text style={[text.meta, styles.minAge]}>{nb.youth.minAge(TERMS.minAge)}</Text>
        </StickyFooter>
      }
    >
      <FadeUp style={styles.hero}>
        <View style={styles.c1} />
        <View style={styles.c2} />
        <View style={styles.heroBody}>
          <Avatar initials={id.initials} colorKey="b" size={56} ring={false} style={shadow.youthAvatar} />
          <Text style={[text.h2, styles.heroTitle]}>{nb.youth.hello(id.firstName)}</Text>
          <Text style={[text.body, styles.heroText]}>{nb.youth.intro(id.age)}</Text>
          <Pill
            label={nb.youth.ageVerified}
            tone="accent"
            leading={<VerifiedIcon size={14} color={colors.ink} />}
          />
        </View>
      </FadeUp>

      <FadeUp delay={100}>
        <Card pad>
          <Text style={[text.h4, styles.cardTitle]}>{nb.youth.canTitle}</Text>
          {nb.youth.can.map((l, i) => (
            <View key={l} style={i < nb.youth.can.length - 1 ? styles.divider : null}>
              <Row ok label={l} />
            </View>
          ))}
        </Card>
      </FadeUp>

      <FadeUp delay={150}>
        <Card pad>
          <View style={styles.lockHead}>
            <Text style={text.h4}>{nb.youth.lockedTitle}</Text>
            <Icon name="lock" size={18} color={colors.mute} />
          </View>
          {nb.youth.locked.map((l, i) => (
            <View key={l} style={i < nb.youth.locked.length - 1 ? styles.divider : null}>
              <Row ok={false} label={l} />
            </View>
          ))}
        </Card>
      </FadeUp>

      <FadeUp delay={200}>
        <Card flat style={styles.info}>
          <View style={styles.infoIcon}>
            <Icon name="eye" size={16} color={colors.cyanDeep} />
          </View>
          <Text style={[text.meta, styles.infoText]}>{nb.youth.visible}</Text>
        </Card>
      </FadeUp>

      <FadeUp delay={250}>
        {nb.youth.checks.map((label, i) => (
          <Pressable
            key={label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: checks[i] }}
            accessibilityLabel={label}
            onPress={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
            style={styles.cb}
          >
            <Checkbox checked={checks[i]} />
            <Text style={[text.body, styles.cbText]}>{label}</Text>
          </Pressable>
        ))}
        <View style={styles.links}>
          <TextLink label={nb.youth.readTerms} icon={null} onPress={() => openWebsite('vilkar')} />
          <TextLink label={nb.youth.readPrivacy} icon={null} onPress={() => openWebsite('personvern')} />
        </View>
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: screenPadding, paddingTop: 6, gap: 18 },
  hero: {
    borderRadius: 28,
    backgroundColor: colors.ink,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  c1: {
    position: 'absolute',
    right: -50,
    top: -50,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.lime,
  },
  c2: {
    position: 'absolute',
    right: 70,
    bottom: -70,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.cyan,
    opacity: 0.35,
  },
  heroBody: { gap: 12, maxWidth: 250 },
  heroTitle: { color: colors.white },
  heroText: { fontSize: 14.5, lineHeight: 21, color: colors.onInk82 },
  cardTitle: { marginBottom: 4 },
  can: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  canIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  canText: { flex: 1, fontSize: 14.5, lineHeight: 19 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line2 },
  lockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  info: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.card,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cyanTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1, color: colors.ink2, fontSize: 13.5, lineHeight: 18.9 },
  cb: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, minHeight: 44 },
  cbText: { flex: 1, fontSize: 14.5, lineHeight: 20.3, fontFamily: text.input.fontFamily },
  links: { flexDirection: 'row', gap: 14, marginTop: 4 },
  minAge: { textAlign: 'center', fontSize: 12 },
});
