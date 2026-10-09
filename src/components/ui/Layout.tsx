import { useEffect, type ReactNode, type RefObject } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from '@/lib/offline';
import { colors, safeTopExtra, screenPadding, sizes, text } from '@/theme/theme';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';

const logo = require('../../../assets/logo-icon.png');

export type ScreenProps = {
  children: ReactNode;
  /** `.phone.white` – white background instead of `bg`. */
  white?: boolean;
  /** Wrap children in a ScrollView (`.scroll`). */
  scroll?: boolean;
  /** Bottom spacer: `nav` = 128 (floating tab bar), `foot` = 140 (sticky footer). */
  spacer?: 'nav' | 'foot' | 'none';
  /** Header rendered above the scroll area (stays put). */
  header?: ReactNode;
  /** Absolute footer (StickyFooter) rendered over the content. */
  footer?: ReactNode;
  scrollProps?: ScrollViewProps;
  /** Ref to the ScrollView (with `scroll`), e.g. to jump back to the top. */
  scrollRef?: RefObject<ScrollView | null>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * `.gray` in design/screens/Tilstander.dc.html: while the phone is offline the
 * content is what was last saved, so it is shown greyed out (the header and
 * footer stay as they are). Fades over .5 s both ways.
 */
function CachedContent({ children }: { children: ReactNode }) {
  const offline = useIsOffline();
  const p = useSharedValue(offline ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(offline ? 1 : 0, { duration: 500 }));
  }, [offline, p]);
  const dim = useAnimatedStyle(() => ({ opacity: 1 - 0.45 * p.value }));
  return <Animated.View style={[styles.flex, dim, offline && styles.gray]}>{children}</Animated.View>;
}

/** `.phone` + `.scroll` – screen container. Headers handle the top safe area. */
export function Screen({
  children,
  white = false,
  scroll = false,
  spacer = 'none',
  header,
  footer,
  scrollProps,
  scrollRef,
  contentStyle,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottom =
    spacer === 'nav' ? sizes.spacerNav + insets.bottom : spacer === 'foot' ? sizes.spacerFoot + insets.bottom : 0;
  return (
    <View testID={testID} style={[styles.screen, { backgroundColor: white ? colors.white : colors.bg }]}>
      {header}
      <CachedContent>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // iOS: keep the focused field (e.g. the price) above the keyboard.
          automaticallyAdjustKeyboardInsets
          {...scrollProps}
          contentContainerStyle={[contentStyle, { paddingBottom: bottom }]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle, bottom ? { paddingBottom: bottom } : null]}>{children}</View>
      )}
      </CachedContent>
      {footer}
    </View>
  );
}

export type MainHeaderProps = {
  /** Current user's initials / photo for the avatar button. */
  initials: string;
  avatarUri?: string | null;
  /** Red dot on the bell. */
  unread?: boolean;
  unreadCount?: number;
  /** testID for the bell dot (tests). */
  dotTestID?: string;
  onBell: () => void;
  onAvatar: () => void;
  onLogo?: () => void;
};

/** `.topbar` – logo + "MinNabo" left; bell (dot) and avatar right. */
export function MainHeader({ initials, avatarUri, unread, unreadCount, dotTestID, onBell, onAvatar, onLogo }: MainHeaderProps) {
  const insets = useSafeAreaInsets();
  const bellLabel = unreadCount ? `Varsler, ${unreadCount} uleste` : 'Varsler';
  return (
    <View style={[styles.topbar, { paddingTop: insets.top + safeTopExtra }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="MinNabo, til forsiden"
        onPress={onLogo}
        disabled={!onLogo}
        style={styles.brand}
      >
        <Image source={logo} style={styles.logo} />
        <Text style={text.brand}>MinNabo</Text>
      </Pressable>
      <View style={styles.tbr}>
        <IconButton icon="bell" accessibilityLabel={bellLabel} dot={unread} dotTestID={dotTestID} onPress={onBell} />
        <Pressable accessibilityRole="button" accessibilityLabel="Åpne profil" onPress={onAvatar} style={styles.avbtn}>
          <Avatar initials={initials} uri={avatarUri} me size={40} />
        </Pressable>
      </View>
    </View>
  );
}

export type SubHeaderProps = {
  title?: string;
  /** Back button handler. Omit to hide the back button. */
  onBack?: () => void;
  /** Use an X instead of the back arrow (modal flows). */
  close?: boolean;
  /** Right slot (44 wide), e.g. an IconButton "Flere valg". */
  right?: ReactNode;
  /** Width of both side slots (default 44; Jobbdag uses 96 for the live pill). */
  sideWidth?: number;
  /** Put the header over content (transparent), e.g. on photo galleries. */
  style?: StyleProp<ViewStyle>;
};

/** `.subbar` – 44 / title / 44 grid; back IconButton labelled "Tilbake". */
export function SubHeader({ title, onBack, close = false, right, sideWidth, style }: SubHeaderProps) {
  const side = sideWidth ? [styles.side, { width: sideWidth }] : styles.side;
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.subbar, { paddingTop: insets.top + safeTopExtra }, style]}>
      <View style={side}>
        {onBack ? (
          <IconButton icon={close ? 'x' : 'back'} accessibilityLabel={close ? 'Lukk' : 'Tilbake'} onPress={onBack} />
        ) : null}
      </View>
      <Text style={[text.subbarTitle, styles.title]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={[side, sideWidth ? styles.sideEnd : null]}>{right}</View>
    </View>
  );
}

/** `.foot` – absolute bottom bar, white 94 % + blur, line2 top border. Children stack with gap 10. */
export function StickyFooter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.foot, { paddingBottom: Math.max(30, insets.bottom + 14) }, style]}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.footBg]} />
      {children}
    </View>
  );
}

/** `.foot .fr` – horizontal button row inside a StickyFooter. */
export function FooterRow({ children }: { children: ReactNode }) {
  return <View style={styles.fr}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  gray: { filter: [{ grayscale: 1 }] },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingBottom: 10,
    zIndex: 5,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: sizes.minTouch },
  logo: { width: 34, height: 34 },
  tbr: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avbtn: { width: sizes.minTouch, height: sizes.minTouch, alignItems: 'center', justifyContent: 'center' },
  subbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 5,
  },
  side: { width: sizes.iconButton, height: sizes.iconButton },
  sideEnd: { alignItems: 'flex-end', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center' },
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.line2,
    gap: 10,
    zIndex: 15,
    overflow: 'hidden',
  },
  footBg: { backgroundColor: colors.footBg },
  fr: { flexDirection: 'row', gap: 10 },
});
