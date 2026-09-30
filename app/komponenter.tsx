import { Redirect } from 'expo-router';
import { KomponenterScreen } from '@/screens/dev/KomponenterScreen';

/** Hidden dev-only route: /komponenter. Not linked from the tab bar or menu. */
export default function Route() {
  if (!__DEV__) return <Redirect href="/" />;
  return <KomponenterScreen />;
}
