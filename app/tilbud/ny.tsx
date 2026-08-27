import { useLocalSearchParams } from 'expo-router';
import { SendProposalScreen } from '@/screens/SendProposalScreen';
export default function Route() {
  const { listing } = useLocalSearchParams<{ listing?: string }>();
  return <SendProposalScreen listingId={typeof listing === 'string' ? listing : ''} mode="give" />;
}
