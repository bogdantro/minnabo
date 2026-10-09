import { useLocalSearchParams } from 'expo-router';
import { LoginScreen } from '@/screens/Onboarding/LoginScreen';

/** Where Vipps sends the person back (`minnabo://vipps/callback?code=…&state=…`). */
export default function VippsCallbackRoute() {
  const { code, state, error } = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  return <LoginScreen callback={{ code, state, error }} />;
}
