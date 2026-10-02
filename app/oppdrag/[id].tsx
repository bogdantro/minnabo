import { useLocalSearchParams, useRouter } from 'expo-router';
import { useListing } from '@/api/queries';
import { FallbackScreen } from '@/components/FallbackScreen';
import type { ScreenStatus } from '@/components/ui/ScreenState';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';

export default function ListingDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: listing, isLoading, isError, refetch } = useListing(id ?? '');

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Only oppdrag exist (rule 1) – any other listing type is treated as not found.
  if (listing && listing.type === 'TASK_REQUEST') {
    return <TaskDetailScreen listing={listing} onBack={goBack} />;
  }

  let status: ScreenStatus = 'loading';
  if (isError) status = 'error';
  else if (!isLoading || listing) status = 'empty';

  return (
    <FallbackScreen
      status={status}
      onRetry={() => refetch()}
      emptyText="Fant ikke oppføringen."
      title="Oppdrag"
    />
  );
}
