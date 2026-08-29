import type { ReactElement } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { PageHeader } from '@/components/TopBar';
import { StaticBottomNav } from '@/components/StaticBottomNav';
import { AppText } from '@/components/ui/Text';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Icon } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';
import { NeedHelpIcon, OfferHelpIcon } from '@/components/icons/ChoiceIcons';

export function ChoiceScreen() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <PageHeader showBack={false} />

      <View style={styles.body}>
        <ScreenTitle>{nb.leggUt.choiceHeading}</ScreenTitle>
        <AppText variant="body" color="navyMuted" style={styles.subtitle}>
          {nb.leggUt.choiceSubtitle}
        </AppText>

        <Choice
          Art={NeedHelpIcon}
          tone="lime"
          badge={nb.leggUt.needBadge}
          title={nb.leggUt.needTitle}
          subtitle={nb.leggUt.needSubtitle}
          onPress={() => router.push('/legg-ut/trenger-jobb')}
        />
        <Choice
          Art={OfferHelpIcon}
          tone="cyan"
          badge={nb.leggUt.offerBadge}
          title={nb.leggUt.offerTitle}
          subtitle={nb.leggUt.offerSubtitle}
          onPress={() => router.push('/legg-ut/tilby-jobb')}
        />

        <View style={styles.footer}>
          <Icon name="shield" size={20} color="cyan" />
          <AppText variant="meta" color="navyMuted" style={styles.footerText}>
            {nb.leggUt.choiceFooter}
          </AppText>
        </View>
      </View>

      <StaticBottomNav active="leggUt" />
    </View>
  );
}

function Choice({
  Art,
  tone,
  badge,
  title,
  subtitle,
  onPress,
}: {
  Art: (p: { size?: number; color?: 'lime' | 'cyan' }) => ReactElement;
  tone: 'lime' | 'cyan';
  badge: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: tone === 'lime' ? tokens.color.limeTint : tokens.color.cyanTint,
          borderLeftColor: tokens.color[tone],
        },
        pressed && styles.choicePressed,
      ]}
    >
      <View style={styles.choiceIcon}>
        <Art size={60} color={tone} />
      </View>
      <View style={styles.choiceRule} />
      <View style={styles.choiceText}>
        <StatusPill label={badge} tone={tone} soft />
        <AppText variant="section" weight="extrabold">
          {title}
        </AppText>
        <AppText variant="meta" color="navyMuted">
          {subtitle}
        </AppText>
      </View>
      <Icon name="chevron-right" size={26} color={tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, paddingHorizontal: tokens.space.xl, paddingTop: tokens.space.sm },
  subtitle: { marginTop: tokens.space.xs, marginBottom: tokens.space.xl },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: tokens.space.xl,
    paddingHorizontal: tokens.space.lg,
    marginBottom: tokens.space.xl,
    ...tokens.shadow.card,
  },
  choicePressed: { opacity: 0.92 },
  choiceIcon: { width: 60, alignItems: 'center' },
  choiceRule: { width: 1, alignSelf: 'stretch', backgroundColor: tokens.color.line },
  choiceText: { flex: 1, gap: tokens.space.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space.sm,
    marginTop: tokens.space.sm,
  },
  footerText: { flex: 1 },
});
