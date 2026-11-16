import { useLocalSearchParams } from 'expo-router';
import { NabolagInfoScreen } from '@/screens/felles/NabolagInfoScreen';

/** «Om nabolaget» (0108): husregler, verter, presentasjon, nye naboer. */
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NabolagInfoScreen nabolagId={id ?? ''} />;
}
