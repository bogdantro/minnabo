import { View, Image, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';

export type AvatarProps = {
  uri?: string;
  initials: string;
  size?: number;
  ring?: boolean;
  online?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function Avatar({
  uri,
  initials,
  size = 40,
  ring = true,
  online = false,
  accessibilityLabel,
  testID,
}: AvatarProps) {
  const dotSize = Math.max(8, Math.round(size * 0.28));

  return (
    <View
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring ? 2 : 0,
          borderColor: tokens.color.cyan,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <AppText
            weight="bold"
            color="white"
            style={{ fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.4) + 2 }}
          >
            {initials}
          </AppText>
        </View>
      )}

      {online ? (
        <View
          testID={testID ? `${testID}-online` : 'avatar-online'}
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: tokens.color.lime,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    backgroundColor: tokens.color.navyMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    borderWidth: 2,
    borderColor: tokens.color.surface,
  },
});
