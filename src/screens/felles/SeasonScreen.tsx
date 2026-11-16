import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { SEASONS, SEASON_TASKS, seasonOf, type Season } from '@/content/seasonChecklist';
import { useLocalSet } from '@/lib/localSet';
import { safePush } from '@/lib/nav';
import { haptics } from '@/lib/haptics';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Button, Checkbox, GrowBar, Icon } from '@/components/ui';
import { CategoryArt } from '@/components/ui/CategoryArt';
import { FellesPage, TONES } from '@/components/community/FellesPage';

const DONE_KEY = 'minnabo.seasonDone.v1';

/** «Sesongsjekk for huset»: this season's tasks, ticks kept on the phone, «Få hjelp» opens Legg ut. */
export function SeasonScreen() {
  const [season, setSeason] = useState<Season>(() => seasonOf(new Date()));
  const [done, toggle] = useLocalSet(DONE_KEY);
  // a tick belongs to this year, so next autumn starts fresh
  const year = new Date().getFullYear();
  const tasks = SEASON_TASKS[season];
  const isDone = (id: string) => done.includes(`${year}:${id}`);
  const count = tasks.filter((t) => isDone(t.id)).length;

  return (
    <FellesPage title={nb.felles.season.title} lead={nb.felles.season.lead} icon="home" tone={TONES.warn} testID="season">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
        {SEASONS.map((s) => {
          const on = s === season;
          return (
            <Pressable key={s} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setSeason(s)} style={[styles.tab, on && styles.tabOn]}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{nb.felles.season.seasons[s]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.progress}>
        <Text style={text.meta}>{nb.felles.season.progress(count, tasks.length)}</Text>
        <GrowBar fill={tasks.length ? count / tasks.length : 0} color={colors.limeDeep} />
      </View>
      {tasks.map((t) => {
        const ticked = isDone(t.id);
        return (
          <View key={t.id} style={[styles.task, shadow.card, ticked && styles.taskDone]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ticked }}
              accessibilityLabel={nb.felles.season.doneA11y(t.title)}
              onPress={() => {
                haptics.light();
                toggle(`${year}:${t.id}`);
              }}
              hitSlop={8}
              style={styles.check}
            >
              <Checkbox checked={ticked} />
            </Pressable>
            <CategoryArt category={t.category} width={44} height={44} radius={14} iconSize={22} />
            <View style={styles.flex}>
              <Text style={[styles.title, ticked && styles.strike]}>{t.title}</Text>
              <Text style={text.meta}>{t.why}</Text>
            </View>
            {!ticked ? (
              <Button
                label={nb.felles.season.getHelp}
                variant="ghost"
                size="sm"
                block={false}
                accessibilityLabel={nb.felles.season.getHelpA11y(t.title)}
                onPress={() => safePush(`/legg-ut?kategori=${t.category}&tittel=${encodeURIComponent(t.title)}`)}
              />
            ) : (
              <Icon name="check" size={18} color={colors.okText} />
            )}
          </View>
        );
      })}
    </FellesPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { gap: 8 },
  tab: { height: 40, paddingHorizontal: 16, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line2 },
  tabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  tabTextOn: { color: colors.white },
  progress: { gap: 6 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface },
  taskDone: { opacity: 0.7 },
  check: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  strike: { textDecorationLine: 'line-through' },
});
