import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Easing } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, radius, shadow, sizes, text } from '@/theme/theme';
import { IconButton } from './IconButton';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Title style: h3 (default) or the larger h2 some sheets use. */
  titleSize?: 'h2' | 'h3';
  /** Small text under the title. */
  subtitle?: string;
  /** Use a scroll container (long lists). */
  scroll?: boolean;
  /** Hide the close button (e.g. a flow that must be finished). */
  hideClose?: boolean;
  /** Tap on scrim / swipe down closes (default true). */
  dismissible?: boolean;
  /** Fixed height as a fraction of the screen (e.g. 0.89 for Meny). Default: size to content. */
  heightRatio?: number;
  /** Sheet background: white (default) or the page grey (`.msheet`). */
  tone?: 'white' | 'page';
  /** Horizontal padding override (Meny uses 16). */
  padding?: number;
  children: ReactNode;
  testID?: string;
};

/**
 * `.sheet` – bottom sheet: radius 32 top, grabber 42×5, title row with close,
 * scrim `rgba(10,23,64,.45)`, 450 ms ease in, max 90 % of the screen.
 * Requires `<BottomSheetModalProvider>` at the app root.
 */
export function Sheet({
  visible,
  onClose,
  title,
  titleSize = 'h3',
  subtitle,
  scroll = false,
  hideClose = false,
  dismissible = true,
  heightRatio,
  tone = 'white',
  padding,
  children,
  testID,
}: SheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: motion.durations.sheet,
    easing: Easing.bezier(...motion.ease),
  });

  // Only dismiss a sheet we actually presented: dismissing a never-shown
  // modal leaves the library in a "dismissing" state that blocks later presents.
  const presented = useRef(false);
  useEffect(() => {
    if (visible) {
      presented.current = true;
      ref.current?.present();
    } else if (presented.current) {
      presented.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        pressBehavior={dismissible ? 'close' : 'none'}
        style={[props.style, styles.scrim]}
      >
        {/* .scrim has backdrop-filter: blur(2px) */}
        <BlurView intensity={6} tint="dark" style={StyleSheet.absoluteFill} />
      </BottomSheetBackdrop>
    ),
    [dismissible],
  );

  const Body = scroll ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      enableDynamicSizing={!heightRatio}
      snapPoints={heightRatio ? [height * heightRatio] : undefined}
      maxDynamicContentSize={height * 0.9}
      enablePanDownToClose={dismissible}
      backdropComponent={renderBackdrop}
      animationConfigs={animationConfigs}
      handleComponent={Grabber}
      backgroundStyle={[styles.bg, tone === 'page' && styles.bgPage]}
      style={shadow.sheet}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      accessible={false}
    >
      <Body
        testID={testID}
        style={[styles.body, padding != null && { paddingHorizontal: padding }]}
        contentContainerStyle={scroll ? { paddingBottom: 34 + insets.bottom } : undefined}
        showsVerticalScrollIndicator={false}
      >
        {title ? (
          <View style={styles.head}>
            <View style={styles.titles}>
              <Text style={text[titleSize]} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={[text.meta, styles.sub]}>{subtitle}</Text> : null}
            </View>
            {!hideClose ? (
              <IconButton icon="x" iconSize={18} accessibilityLabel="Lukk" onPress={() => ref.current?.dismiss()} />
            ) : null}
          </View>
        ) : null}
        {children}
        {!scroll ? <View style={{ height: 34 + insets.bottom }} /> : null}
      </Body>
    </BottomSheetModal>
  );
}

function Grabber() {
  return (
    <View style={styles.grabWrap}>
      <View style={styles.grab} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  bgPage: { backgroundColor: colors.bg },
  bg: { backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  body: { paddingHorizontal: 20 },
  grabWrap: { paddingTop: 10, paddingBottom: 16, alignItems: 'center' },
  grab: {
    width: sizes.grabberW,
    height: sizes.grabberH,
    borderRadius: 3,
    backgroundColor: colors.grabber,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  titles: { flex: 1 },
  sub: { marginTop: 4 },
});
