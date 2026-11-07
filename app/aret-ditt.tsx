import { useLocalSearchParams } from 'expo-router';
import { YearRecapScreen } from '@/screens/YearRecapScreen';

/** /aret-ditt?ar=2026. January still shows last year: that's when people look back. */
export default function Route() {
  const { ar } = useLocalSearchParams<{ ar?: string }>();
  const now = new Date();
  const year = Number(ar) || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  return <YearRecapScreen year={year} />;
}
