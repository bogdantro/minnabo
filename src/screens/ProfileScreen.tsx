import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { CATEGORIES as categories } from '@/domain/categories';
import { useProfile, useReviews, useUpdateProfile } from '@/api/queries';
import { useSession } from '@/auth/session';
import { safePush } from '@/lib/nav';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { PageHeader } from '@/components/TopBar';
import { AppText } from '@/components/ui/Text';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Rating } from '@/components/ui/Rating';
import { StatusPill } from '@/components/ui/StatusPill';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { InfoCard, InfoRow } from '@/components/ui/InfoCard';
import { VerificationBadge } from '@/components/VerificationBadge';
import { FallbackScreen } from '@/components/FallbackScreen';
import { ReviewList } from '@/components/ReviewList';

export function ProfileScreen({ profileId }: { profileId?: string }) {
  const myId = useSession().userId ?? '';
  const id = profileId ?? myId;
  const isSelf = id === myId;
  const { data: profile, isLoading, isError, refetch } = useProfile(id);
  const { data: reviews } = useReviews(id);
  const update = useUpdateProfile();

  const setPaused = async (paused: boolean) => {
    if (paused) {
      const ok = await confirm({
        title: nb.profile.pauseConfirmTitle,
        message: nb.profile.pauseConfirmBody,
        confirmLabel: nb.profile.pauseNow,
      });
      if (!ok) return;
    }
    update.mutate(
      { paused },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(paused ? nb.profile.pausedToast : nb.profile.resumedToast);
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  if (!profile) {
    return (
      <FallbackScreen
        status={isError ? 'error' : isLoading ? 'loading' : 'empty'}
        onRetry={() => refetch()}
        emptyText="Fant ikke profilen."
        title={nb.profile.title}
      />
    );
  }

  const categoryLabels = (profile.categorySlugs ?? [])
    .map((slug) => categories.find((c) => c.slug === slug)?.label)
    .filter(Boolean) as string[];

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.profile.title} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Avatar uri={profile.avatarUrl} initials={profile.initials} size={84} />
          <ScreenTitle>{profile.displayName}</ScreenTitle>
          <View style={styles.metaRow}>
            <Icon name="map-pin" size={14} color="cyan" />
            <AppText variant="meta" color="navyMuted">
              {profile.location.place}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              · {nb.profile.memberSince} {profile.memberSince}
            </AppText>
          </View>
          {profile.rating ? <Rating value={profile.rating} /> : null}
        </View>

        {isSelf && profile.paused ? (
          <View style={styles.pausedBanner}>
            <Icon name="pause-circle" size={18} color="navy" />
            <View style={styles.pausedText}>
              <AppText variant="meta" weight="bold">
                {nb.profile.pausedTitle}
              </AppText>
              <AppText variant="meta" color="navyMuted">
                {nb.profile.pausedBody}
              </AppText>
            </View>
          </View>
        ) : null}

        {isSelf ? (
          <>
            <Button
              label={nb.profile.edit}
              variant="secondary"
              onPress={() => safePush('/profil/rediger')}
            />
            <Button
              label={profile.paused ? nb.profile.resumeProfile : nb.profile.pauseProfile}
              variant="ghost"
              iconLeft={profile.paused ? 'play' : 'pause'}
              loading={update.isPending}
              onPress={() => setPaused(!profile.paused)}
            />
          </>
        ) : (
          <Button
            label={nb.profile.reportOrBlock}
            variant="ghost"
            iconLeft="flag"
            onPress={() => safePush(`/rapporter?profil=${id}`)}
          />
        )}

        {profile.verifications.some((v) => v.verified) ? (
          <InfoCard>
            {profile.verifications
              .filter((v) => v.verified)
              .map((v, i, arr) => (
                <View key={v.kind} style={styles.verRow}>
                  <VerificationBadge verification={v} showExplanation />
                  {i < arr.length - 1 ? <View style={styles.verDivider} /> : null}
                </View>
              ))}
          </InfoCard>
        ) : null}

        {profile.presentation ? (
          <View style={styles.section}>
            <SectionHeader title={nb.profile.presentation} />
            <AppText variant="body">{profile.presentation}</AppText>
          </View>
        ) : null}

        {profile.services?.length ? (
          <View style={styles.section}>
            <SectionHeader title={nb.profile.services} />
            <View style={styles.chips}>
              {profile.services.map((s) => (
                <StatusPill key={s} label={s} tone="lime" />
              ))}
            </View>
          </View>
        ) : null}

        {categoryLabels.length ? (
          <View style={styles.section}>
            <SectionHeader title={nb.profile.categories} />
            <View style={styles.chips}>
              {categoryLabels.map((c) => (
                <StatusPill key={c} label={c} tone="cyan" />
              ))}
            </View>
          </View>
        ) : null}

        <InfoCard>
          <InfoRow
            icon="check-circle"
            label={nb.profile.completedTasks}
            value={String(profile.completedTasks ?? 0)}
          />
          <InfoRow
            icon="star"
            label={nb.profile.reviews}
            value={profile.rating ? String(profile.rating.count) : '0'}
          />
          <InfoRow
            icon="shield"
            label={nb.profile.reliability}
            value={
              profile.reliability?.score != null
                ? `${profile.reliability.score} %`
                : nb.profile.reliabilityNew
            }
            last
          />
        </InfoCard>

        {profile.reliability?.score != null ? (
          <AppText variant="meta" color="navyMuted">
            {nb.profile.reliabilityExplainer}
          </AppText>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title={nb.profile.reviews}
            actionLabel={isSelf ? nb.profile.verificationCenter : undefined}
            onAction={isSelf ? () => safePush('/verifisering') : undefined}
          />
          <ReviewList reviews={reviews ?? []} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.lg,
  },
  head: { alignItems: 'center', gap: tokens.space.sm, paddingVertical: tokens.space.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  section: { gap: tokens.space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  verRow: { paddingVertical: tokens.space.sm },
  verDivider: { height: 1, backgroundColor: tokens.color.line, marginTop: tokens.space.sm },
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.limeTint,
    borderRadius: tokens.radius.card,
    padding: tokens.space.md,
  },
  pausedText: { flex: 1, gap: 1 },
});
