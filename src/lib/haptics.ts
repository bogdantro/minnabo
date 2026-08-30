import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS !== 'web' && process.env.NODE_ENV !== 'test';

/** Thin wrapper so call sites stay tidy and web/tests are no-ops. */
export const haptics = {
  light: () => enabled && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => enabled && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => enabled && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => enabled && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => enabled && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  select: () => enabled && void Haptics.selectionAsync(),
};
