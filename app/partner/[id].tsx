import { useLocalSearchParams } from 'expo-router';
import { PartnerScreen } from '@/screens/PartnerScreen';

/** A hovedpartner's own page. */
export default function PartnerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PartnerScreen partnerId={id ?? ''} />;
}
