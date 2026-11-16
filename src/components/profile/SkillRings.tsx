import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { CategoryJobs } from '@/domain/types';
import nb from '@/i18n/nb';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { colors, fonts, text } from '@/theme/theme';
import { CategoryArt } from '@/components/ui';

/** Finished jobs in one category for each level: «Første jobb», «Erfaren», «Dyktig», «Mester». */
export const SKILL_TIERS = [1, 5, 10, 25] as const;

/** 7 jobs → level 2 (Erfaren), 70 % of the way to Dyktig. */
export function skillLevel(jobs: number): { level: number; progress: number; next: number | null } {
  const level = SKILL_TIERS.filter((t) => jobs >= t).length;
  const next = SKILL_TIERS[level] ?? null;
  const prev = level ? SKILL_TIERS[level - 1] : 0;
  const progress = next === null ? 1 : (jobs - prev) / (next - prev);
  return { level, progress: Math.max(0, Math.min(1, progress)), next };
}

const SIZE = 74;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** Ferdighetsmerker (0101): one ring per category with finished jobs, fuller the more jobs. */
export function SkillRings({ jobs }: { jobs: CategoryJobs[] }) {
  const list = [...jobs].filter((j) => j.jobs > 0).sort((a, b) => b.jobs - a.jobs);
  if (!list.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {list.map((j) => {
        const art = categoryArtId(j.categorySlug);
        const { level, progress, next } = skillLevel(j.jobs);
        const label = categoryLabel(art);
        return (
          <View key={j.categorySlug} style={styles.item} accessible accessibilityLabel={nb.skills.a11y(label, j.jobs, nb.skills.levels[level])}>
            <View style={styles.ring}>
              <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.line2} strokeWidth={STROKE} fill="none" />
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  stroke={level >= SKILL_TIERS.length ? colors.ink : colors.limeDot}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${C} ${C}`}
                  strokeDashoffset={C * (1 - progress)}
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              </Svg>
              <CategoryArt category={art} width={50} height={50} radius={25} iconSize={22} />
              <View style={styles.count}>
                <Text style={styles.countText}>{j.jobs}</Text>
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.level} numberOfLines={1}>
              {nb.skills.levels[level]}
            </Text>
            {next ? <Text style={styles.next}>{nb.skills.toNext(next - j.jobs)}</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 14, paddingTop: 12, paddingRight: 8 },
  item: { width: 86, alignItems: 'center', gap: 2 },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  count: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lime },
  name: { ...text.label, fontSize: 13, textAlign: 'center' },
  level: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.limeDeep, textAlign: 'center' },
  next: { ...text.meta, fontSize: 11, textAlign: 'center' },
});
