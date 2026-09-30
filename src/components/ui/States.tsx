import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { colors, motion, radius, shadow, sizes, text } from '@/theme/theme';
import { Button } from './Button';
import { DrawnCheck } from './Celebrate';
import { Icon, type IconName } from './Icon';

export type IllustrationTone = 'need' | 'error' | 'neutral' | 'offer';

const ILL: Record<IllustrationTone, { b1: string; b2: string; fg: string }> = {
  need: { b1: colors.limeTint, b2: colors.cyanTint, fg: colors.limeDeep },
  error: { b1: colors.dangerTint, b2: colors.warnTint, fg: colors.danger },
  neutral: { b1: colors.track, b2: colors.cyanTint, fg: colors.ink },
  offer: { b1: colors.cyanTint, b2: colors.limeTint, fg: colors.cyanDeep },
};

/** `.ill` – two soft tinted circles + white 80 × 80 tile (radius 26) with a 32 px icon. */
export function StateIllustration({ icon, tone = 'need' }: { icon: IconName; tone?: IllustrationTone }) {
  const c = ILL[tone];
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(motion.spring.damping).stiffness(motion.spring.stiffness)}
      style={styles.ill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.b1, { backgroundColor: c.b1 }]} />
      <View style={[styles.b2, { backgroundColor: c.b2 }]} />
      <View style={[styles.core, shadow.medium]}>
        <Icon name={icon} size={32} color={c.fg} />
      </View>
    </Animated.View>
  );
}

export type StateViewProps = {
  icon: IconName;
  tone?: IllustrationTone;
  title: string;
  body?: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void | Promise<void>;
  actionLoading?: boolean;
  /** Extra content under the action (e.g. a confirmation pill). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Centred illustration + title + body + ink button. Base for the state screens. */
export function StateView({
  icon,
  tone,
  title,
  body,
  actionLabel,
  actionIcon,
  onAction,
  actionLoading,
  children,
  style,
}: StateViewProps) {
  return (
    <View style={[styles.center, style]} accessibilityLiveRegion="polite">
      <StateIllustration icon={icon} tone={tone} />
      <Text style={[text.h3, styles.centerText]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[text.stateBody, styles.centerText]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          icon={actionIcon}
          variant="ink"
          block={false}
          onPress={onAction}
          loading={actionLoading}
          style={styles.selfCenter}
        />
      ) : null}
      {children}
    </View>
  );
}

/** Tom – nothing to show. */
export function EmptyState(props: Omit<StateViewProps, 'tone'> & { tone?: IllustrationTone }) {
  return <StateView tone="need" {...props} />;
}

/** Feil – "Noe gikk galt" + "Prøv igjen" (spinner "Prøver …" while retrying). */
export function ErrorState({
  onRetry,
  retrying,
  title = 'Noe gikk galt',
  body = 'Vi fikk ikke kontakt med MinNabo. Prøv igjen om litt.',
}: {
  onRetry?: () => void | Promise<void>;
  retrying?: boolean;
  title?: string;
  body?: string;
}) {
  return (
    <StateView
      icon="alert"
      tone="error"
      title={title}
      body={body}
      actionLabel={retrying ? 'Prøver …' : 'Prøv igjen'}
      actionIcon="refresh"
      onAction={onRetry}
      actionLoading={retrying}
    />
  );
}

/** Ingen tilgang – protected pages (admin, youth-locked features). */
export function NoAccess({
  title = 'Denne siden er bare for administratorer',
  body = 'Tror du dette er feil? Ta kontakt med MinNabo.',
  actionLabel = 'Til forsiden',
  onAction,
}: {
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return <StateView icon="lock" tone="neutral" title={title} body={body} actionLabel={actionLabel} onAction={onAction} />;
}

/** Suksess – drawn check, display title, body and optional payment note underneath. */
export function SuccessState({
  title,
  body,
  children,
  playKey,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
  playKey?: number;
}) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <DrawnCheck size={120} playKey={playKey} />
      <Text style={[text.h2, styles.centerText, styles.successTitle]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[text.stateBody, styles.centerText]}>{body}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  centerText: { textAlign: 'center' },
  selfCenter: { alignSelf: 'center' },
  successTitle: { marginTop: 14 },
  ill: { width: sizes.stateIllW, height: sizes.stateIllH },
  b1: { position: 'absolute', left: 10, top: 10, width: 130, height: 130, borderRadius: 65 },
  b2: { position: 'absolute', right: 0, bottom: 6, width: 56, height: 56, borderRadius: 28 },
  core: {
    position: 'absolute',
    left: 35,
    top: 35,
    width: sizes.stateTile,
    height: sizes.stateTile,
    borderRadius: radius.stateTile,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
