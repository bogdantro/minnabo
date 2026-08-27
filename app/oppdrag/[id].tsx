import { useLocalSearchParams, useRouter } from 'expo-router';
import { useListing } from '@/api/queries';
import { FallbackScreen } from '@/components/FallbackScreen';
import type { ScreenStatus } from '@/components/ui/ScreenState';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { ServiceOfferDetailScreen } from '@/screens/ServiceOfferDetailScreen';

export default function ListingDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: listing, isLoading, isError, refetch } = useListing(id ?? '');

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (listing) {
    return listing.type === 'TASK_REQUEST' ? (
      <TaskDetailScreen listing={listing} onBack={goBack} />
    ) : (
      <ServiceOfferDetailScreen listing={listing} onBack={goBack} />
    );
  }

  let status: ScreenStatus = 'loading';
  if (isError) status = 'error';
  else if (!isLoading) status = 'empty';

  return (
    <FallbackScreen
      status={status}
      onRetry={() => refetch()}
      emptyText="Fant ikke oppføringen."
      title="Oppdragsdetaljer"
    />
  );
}
