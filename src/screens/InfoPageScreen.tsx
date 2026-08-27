import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';

export type InfoSection = { heading?: string; body: string };

export function InfoPageScreen({
  title,
  sections,
}: {
  title: string;
  sections: InfoSection[];
}) {
  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{title}</ScreenTitle>
        {sections.map((s, i) => (
          <View key={i} style={styles.section}>
            {s.heading ? (
              <AppText variant="cardTitle" weight="bold">
                {s.heading}
              </AppText>
            ) : null}
            <AppText variant="body" color="navyMuted">
              {s.body}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxxl },
  section: { gap: tokens.space.sm },
});
