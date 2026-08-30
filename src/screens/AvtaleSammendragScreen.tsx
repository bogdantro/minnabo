import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatPrice } from '@/domain/price';
import { formatRelative } from '@/lib/datetime';
import { useProposal, useAgreementByProposal, useListing, useProfile } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { DetailTopBar } from '@/components/TopBar';
import { FallbackScreen } from '@/components/FallbackScreen';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { InfoCard, InfoRow } from '@/components/ui/InfoCard';
import { InfoBox } from '@/components/ui/InfoBox';
import { Avatar } from '@/components/ui/Avatar';

export function AvtaleSammendragScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const { data: agreement } = useAgreementByProposal(proposalId);
  const { data: listing } = useListing(proposal?.listingId ?? '');
  const otherId = proposal
    ? proposal.fromProfileId === me.id
      ? proposal.toProfileId
      : proposal.fromProfileId
    : '';
  const { data: other } = useProfile(otherId);

  if (!proposal) {
    return (
      <FallbackScreen
        status={isError ? 'error' : isLoading ? 'loading' : 'empty'}
        onRetry={() => refetch()}
        title={nb.avtale.title}
      />
    );
  }
  const price = agreement?.price ?? proposal.price;
  const when = agreement?.scheduledText ?? proposal.scheduledText;
  const description = agreement?.description || proposal.message || listing?.task?.description || '';
  const caveats = agreement?.caveats ?? proposal.caveats;

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <DetailTopBar
        title={nb.avtale.title}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Icon name="file-text" size={26} color="white" />
          </View>
          <ScreenTitle>{nb.avtale.heading}</ScreenTitle>
          <AppText variant="body" color="navyMuted" align="center">
            {nb.avtale.sub}
          </AppText>
        </View>

        <AppText variant="cardTitle" weight="bold">
          {listing?.title ?? 'Oppdrag'}
        </AppText>

        <InfoCard>
          <InfoRow icon="tag" label={nb.avtale.price} value={formatPrice(price)} />
          {when ? <InfoRow icon="calendar" label={nb.avtale.when} value={when} /> : null}
          {caveats ? <InfoRow icon="alert-circle" label={nb.avtale.caveats} value={caveats} /> : null}
          <InfoRow
            icon="clock"
            label={nb.avtale.agreedAt}
            value={formatRelative(agreement?.agreedAt ?? proposal.createdAt)}
            last
          />
        </InfoCard>

        {description ? (
          <View style={styles.section}>
            <AppText variant="cardTitle" weight="bold">
              {nb.avtale.description}
            </AppText>
            <AppText variant="body" color="navyMuted">
              {description}
            </AppText>
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="cardTitle" weight="bold">
            {nb.avtale.parties}
          </AppText>
          <View style={styles.parties}>
            <Party name={me.displayName} uri={me.avatarUrl} initials={me.initials} />
            <Icon name="arrow-right" size={18} color="navyMuted" />
            <Party name={other?.displayName ?? 'Motpart'} uri={other?.avatarUrl} initials={other?.initials ?? '?'} />
          </View>
        </View>

        <InfoBox icon="shield">{nb.avtale.paymentNote}</InfoBox>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={nb.avtale.toCompletion}
          onPress={() => safePush(`/fullfor/${proposalId}`)}
          iconRight="check"
        />
        <Button
          label={nb.avtale.openChat}
          variant="secondary"
          onPress={() => safePush(`/chat/${proposal.conversationId}`)}
        />
      </View>
    </SafeAreaView>
  );
}

function Party({ name, uri, initials }: { name: string; uri?: string; initials: string }) {
  return (
    <View style={styles.party}>
      <Avatar uri={uri} initials={initials} size={44} />
      <AppText variant="meta" weight="bold" numberOfLines={1}>
        {name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxl },
  hero: { alignItems: 'center', gap: tokens.space.sm, paddingVertical: tokens.space.md },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.xs,
  },
  section: { gap: tokens.space.xs },
  parties: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  party: { flex: 1, alignItems: 'center', gap: 4 },
  footer: {
    padding: tokens.space.xl,
    gap: tokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
