import type { ComponentType } from 'react';
import { Redirect } from 'expo-router';
import { ENV } from '@/lib/env';

/**
 * Wraps an onboarding screen so that in mock mode (no backend, no login) the
 * route bounces straight to the app instead of trying to talk to Supabase.
 */
export function onboardingRoute<P extends object>(Screen: ComponentType<P>) {
  return function OnboardingRoute(props: P) {
    if (ENV.useMocks) return <Redirect href="/" />;
    return <Screen {...props} />;
  };
}
