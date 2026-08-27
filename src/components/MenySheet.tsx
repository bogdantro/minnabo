import { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { appMenu } from '@/config/appMenu';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

export function MenySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.min(height * 0.9, 780);

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
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(sheetHeight);
      backdrop.setValue(0);
    }
  }, [visible, sheetHeight, translateY, backdrop]);

  const dismiss = (then?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: sheetHeight,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      then?.();
    });
  };

  const go = (route: string) => dismiss(() => router.push(route as never));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => dismiss()}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={nb.common.close}
            onPress={() => dismiss()}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { height: sheetHeight, paddingBottom: insets.bottom + tokens.space.lg, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <AppText variant="section" weight="extrabold">
              {nb.tabs.meny}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={nb.common.close} onPress={() => dismiss()}>
              <Icon name="x" size={22} color="navy" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {appMenu.map((section) => (
              <View key={section.title} style={styles.section}>
                <AppText variant="meta" weight="bold" color="navyMuted" style={styles.sectionTitle}>
                  {section.title.toUpperCase()}
                </AppText>
                {section.items.map((item) => (
                  <Pressable
                    key={item.route}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => go(item.route)}
                    style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  >
                    <View style={styles.itemIcon}>
                      <Icon name={item.icon} size={20} color="navy" />
                    </View>
                    <AppText variant="body" weight="bold" style={styles.itemLabel}>
                      {item.label}
                    </AppText>
                    <Icon name="chevron-right" size={18} color="navyMuted" />
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
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
    marginBottom: tokens.space.sm,
  },
  list: { paddingBottom: tokens.space.lg },
  section: { marginTop: tokens.space.md, gap: 2 },
  sectionTitle: { letterSpacing: 0.6, marginBottom: tokens.space.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.md,
  },
  itemPressed: { opacity: 0.55 },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { flex: 1 },
});
