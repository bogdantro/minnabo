import { Redirect } from 'expo-router';
import { BedriftRegistreringScreen } from '@/screens/BedriftRegistreringScreen';
import { useFeatureFlags } from '@/config/featureFlags';

/** "For bedrifter" is hidden while `businessRegistration` is off – a direct link goes home. */
export default function BedriftRoute() {
  if (!useFeatureFlags().businessRegistration) return <Redirect href="/" />;
  return <BedriftRegistreringScreen />;
}
