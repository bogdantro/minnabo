import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  BottomSheetFooter,
  type BottomSheetFooterProps,
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
  /** Extra element left of the close button (e.g. "Nullstill"). */
  headerAction?: ReactNode;
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
  /** Pinned to the bottom of the sheet above the keyboard (a reply field, «Publiser»); the content scrolls under it. */
  footer?: ReactNode;
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
  headerAction,
  hideClose = false,
  dismissible = true,
  heightRatio,
  tone = 'white',
  padding,
  footer,
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
  // `visible` turned false and the slide-down is still running. The library ignores `present()` until it ends,
  // so a reopen in that time (Meny opened again, or back from a page opened in Meny) waits for `onDismiss`.
  const closingByProp = useRef(false);
  const wanted = useRef(visible);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // bumped to replace a modal stuck half-closed (see below)
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    wanted.current = visible;
    if (visible) {
      if (closingByProp.current) return;
      presented.current = true;
      ref.current?.present();
    } else if (presented.current) {
      presented.current = false;
      closingByProp.current = true;
      ref.current?.dismiss();
      // if the library never reports the close (it was never really shown), don't wait for ever.
      // Kept in a ref: reopening during the close must not cancel it.
      if (graceTimer.current) clearTimeout(graceTimer.current);
      graceTimer.current = setTimeout(() => {
        graceTimer.current = undefined;
        if (!closingByProp.current) return;
        // a modal stuck half-closed ignores present(): start over with a fresh one
        closingByProp.current = false;
        setEpoch((n) => n + 1);
      }, motion.durations.sheet + CLOSE_GRACE_MS);
    }
  }, [visible]);
  useEffect(() => () => clearTimeout(graceTimer.current), []);
  // the fresh modal opens if the sheet is wanted
  useEffect(() => {
    if (epoch && wanted.current) {
      presented.current = true;
      ref.current?.present();
    }
  }, [epoch]);

  const handleDismiss = useCallback(() => {
    presented.current = false;
    if (closingByProp.current) {
      // our own close finished; open again if the sheet was asked for in the meantime
      closingByProp.current = false;
      if (wanted.current) {
        presented.current = true;
        ref.current?.present();
      }
      return;
    }
    // the person closed it (swipe, scrim, close button): tell the parent
    onClose();
  }, [onClose]);

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
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>{footer}</View>
      </BottomSheetFooter>
    ),
    [footer, insets.bottom],
  );

  return (
    <BottomSheetModal
      key={epoch}
      ref={ref}
      onDismiss={handleDismiss}
      // a date field inside a sheet opens a sheet of its own: the one below must stay open, not be replaced
      stackBehavior="push"
      enableDynamicSizing={!heightRatio}
      // never taller than the space below the status bar, and never pushed under it by the keyboard
      topInset={insets.top}
      snapPoints={heightRatio ? [Math.min(height * heightRatio, height - insets.top - 8)] : undefined}
      maxDynamicContentSize={Math.min(height * 0.9, height - insets.top - 8)}
      enablePanDownToClose={dismissible}
      backdropComponent={renderBackdrop}
      footerComponent={footer ? renderFooter : undefined}
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
        // with a pinned footer the last lines must scroll clear of it
        contentContainerStyle={scroll ? { paddingBottom: (footer ? FOOTER_SPACE : 34) + insets.bottom } : undefined}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {title ? (
          <View style={styles.head}>
            <View style={styles.titles}>
              <Text style={text[titleSize]} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={[text.meta, styles.sub]}>{subtitle}</Text> : null}
            </View>
            {headerAction}
            {!hideClose ? (
              <IconButton icon="x" iconSize={18} accessibilityLabel="Lukk" onPress={() => ref.current?.dismiss()} />
            ) : null}
          </View>
        ) : null}
        {children}
        {!scroll ? <View style={{ height: (footer ? FOOTER_SPACE : 34) + insets.bottom }} /> : null}
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

/** Extra time after the slide-down before a close the library never reported is treated as done. */
const CLOSE_GRACE_MS = 400;

/** Room left under the content for a pinned footer (a 52 px field or button plus its padding). */
const FOOTER_SPACE = 96;

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line2 },
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
