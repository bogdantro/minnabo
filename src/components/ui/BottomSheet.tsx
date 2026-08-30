import { useEffect, useRef, type ReactNode } from 'react';
import {
  Modal,
  View,
  Pressable,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './Text';
import { Icon } from './Icon';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** fraction of screen height (0–1) */
  heightRatio?: number;
  maxHeight?: number;
  children: ReactNode;
};

export function BottomSheet({
  visible,
  onClose,
  title,
  heightRatio = 0.6,
  maxHeight = 620,
  children,
}: BottomSheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.min(height * heightRatio, maxHeight);

  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(sheetHeight);
      backdrop.setValue(0);
    }
  }, [visible, sheetHeight, translateY, backdrop]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: sheetHeight,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={nb.common.close}
            onPress={dismiss}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              paddingBottom: insets.bottom + tokens.space.lg,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle} />
          {title ? (
            <View style={styles.titleRow}>
              <AppText variant="section" weight="extrabold">
                {title}
              </AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={nb.common.close} onPress={dismiss}>
                <Icon name="x" size={22} color="navy" />
              </Pressable>
            </View>
          ) : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.color.overlay,
  },
  sheet: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.md,
    ...tokens.shadow.fab,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.color.line,
    marginBottom: tokens.space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.space.md,
  },
});
