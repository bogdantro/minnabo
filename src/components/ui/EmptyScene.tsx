import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { colors, motion, shadow } from '@/theme/theme';
import { Icon, type IconName } from './Icon';

export type EmptySceneTone = 'lime' | 'cyan';

const TONE: Record<EmptySceneTone, { hill: string; badge: string; fg: string }> = {
  lime: { hill: colors.limeTint, badge: colors.lime, fg: colors.ink },
  cyan: { hill: colors.cyanTint, badge: colors.cyanDeep, fg: colors.white },
};

const W = 200;
const H = 128;

/**
 * Empty states with a little drawing instead of a lone icon: a quiet neighbourhood – a hill,
 * two houses, a tree and the sun – with the screen's own icon in a badge on top.
 * Flat colours only (no gradients), every colour from the theme.
 */
export function EmptyScene({ icon, tone = 'lime' }: { icon: IconName; tone?: EmptySceneTone }) {
  const t = TONE[tone];
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(motion.spring.damping).stiffness(motion.spring.stiffness)}
      style={styles.wrap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="empty-scene"
    >
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* sun */}
        <Circle cx={160} cy={28} r={14} fill={colors.warnTint} />
        {/* hill */}
        <Ellipse cx={100} cy={128} rx={110} ry={38} fill={t.hill} />
        {/* house left */}
        <Rect x={30} y={78} width={34} height={28} rx={3} fill={colors.white} />
        <Path d="M26 80 L47 62 L68 80 Z" fill={colors.ink} />
        <Rect x={42} y={92} width={10} height={14} rx={2} fill={t.hill} />
        {/* house right */}
        <Rect x={138} y={84} width={30} height={24} rx={3} fill={colors.white} />
        <Path d="M134 86 L153 70 L172 86 Z" fill={colors.ink2} />
        <Rect x={148} y={94} width={9} height={9} rx={2} fill={t.hill} />
        {/* tree */}
        <Rect x={117} y={92} width={4} height={16} rx={2} fill={colors.ink2} />
        <Circle cx={119} cy={86} r={11} fill={colors.lime} />
      </Svg>
      <View style={[styles.badge, shadow.medium, { backgroundColor: t.badge }]}>
        <Icon name={icon} size={26} color={t.fg} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: H, alignSelf: 'center', marginBottom: 6 },
  badge: {
    position: 'absolute',
    left: W / 2 - 30,
    top: 12,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
  },
});
