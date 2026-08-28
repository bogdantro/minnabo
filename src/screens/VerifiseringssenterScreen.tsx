import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { VerificationKind } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { profileRepository } from '@/data/profileRepository';
import { useProfile, useVerify } from '@/api/queries';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { InfoBox } from '@/components/ui/InfoBox';

type Row = {
  kind: VerificationKind | 'BANKID';
  icon: IconName;
  name: string;
  what: string;
  soon?: boolean;
};

const ROWS: Row[] = [
  { kind: 'PHONE', icon: 'phone', name: nb.verificationCenter.phoneName, what: nb.verificationCenter.phoneWhat },
  { kind: 'EMAIL', icon: 'mail', name: nb.verificationCenter.emailName, what: nb.verificationCenter.emailWhat },
  { kind: 'BANKID', icon: 'shield', name: nb.verificationCenter.bankIdName, what: nb.verificationCenter.bankIdWhat, soon: true },
  { kind: 'BUSINESS', icon: 'home', name: nb.verificationCenter.businessName, what: nb.verificationCenter.businessWhat },
];

export function VerifiseringssenterScreen() {
  const router = useRouter();
  const id = profileRepository.currentUserId;
  const { data: profile } = useProfile(id);
  const verify = useVerify();

  const verifiedCount = (profile?.verifications ?? []).filter((v) => v.verified).length;

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.verificationCenter.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.verificationCenter.heading}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {nb.verificationCenter.sub}
        </AppText>

        <View style={styles.score}>
          <View style={styles.scoreBadge}>
            <Icon name="shield" size={22} color="white" />
          </View>
          <View style={styles.scoreText}>
            <AppText variant="cardTitle" weight="bold">
              {nb.verificationCenter.scoreLabel}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              {verifiedCount} / {ROWS.length - 1} {nb.verificationCenter.verified.toLowerCase()}
            </AppText>
          </View>
        </View>

        {ROWS.map((row) => {
          const v = profile?.verifications.find((x) => x.kind === row.kind);
          const isVerified = !!v?.verified;
          return (
            <View key={row.kind} style={styles.row}>
              <View style={styles.rowIcon}>
                <Icon name={row.icon} size={20} color={isVerified ? 'shieldGreen' : 'navy'} />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowHead}>
                  <AppText variant="cardTitle" weight="bold">
                    {row.name}
                  </AppText>
                  {isVerified ? (
                    <View style={styles.verifiedTag}>
                      <Icon name="check" size={12} color="white" />
                      <AppText variant="meta" weight="bold" color="white">
                        {nb.verificationCenter.verified}
                      </AppText>
                    </View>
                  ) : row.soon ? (
                    <AppText variant="meta" weight="bold" color="navyMuted">
                      {nb.verificationCenter.bankIdSoon}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="meta" color="navyMuted">
                  {row.what}
                </AppText>
                {!isVerified && !row.soon ? (
                  row.kind === 'BUSINESS' ? (
                    <Button
                      label={nb.verificationCenter.registerBusiness}
                      variant="secondary"
                      onPress={() => safePush('/bedrift')}
                      style={styles.rowBtn}
                    />
                  ) : (
                    <Button
                      label={verify.isPending ? nb.verificationCenter.verifying : nb.verificationCenter.verifyNow}
                      variant="secondary"
                      onPress={() => verify.mutate(row.kind as 'PHONE' | 'EMAIL')}
                      loading={verify.isPending && verify.variables === row.kind}
                      style={styles.rowBtn}
                    />
                  )
                ) : null}
              </View>
            </View>
          );
        })}

        <InfoBox icon="lock">
          Verifiseringsmerker forklarer hva som er kontrollert. MinNabo deler aldri
          detaljene dine med andre brukere.
        </InfoBox>

        <Button label={nb.common.close} variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxxl },
  score: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.limeTint,
    borderRadius: tokens.radius.card,
    padding: tokens.space.md,
  },
  scoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { flex: 1, gap: 1 },
  row: {
    flexDirection: 'row',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    ...tokens.shadow.card,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: tokens.color.shieldGreen,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  rowBtn: { marginTop: tokens.space.xs, alignSelf: 'flex-start', paddingHorizontal: tokens.space.xl },
});
