import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PublicProfile } from '@/domain/types';
import nb from '@/i18n/nb';
import { useCategoryJobs, useReliability, useReviews } from '@/api/queries';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { attestPdfHtml, type AttestInput } from '@/lib/attestPdf';
import { longDate, monthYear } from '@/lib/datetime';
import { sharePdf } from '@/lib/pdf';
import { toast } from '@/lib/toast';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button, Icon } from '@/components/ui';

const QUOTES = 3;
const QUOTE_MAX = 220;
const TAGS = 5;

/**
 * What goes on the attest, from the profile and its reviews (pure, for tests).
 * Only reviews a moderator has let through (every youth review waits for one, 0094); the best and newest first.
 */
export function attestInput(
  profile: PublicProfile,
  reviews: { rating: number; comment?: string; tags?: string[]; createdAt: string; approval?: string }[],
  jobs: { categorySlug: string; jobs: number }[],
  showsUp: number | undefined,
  now: Date,
): AttestInput {
  const ok = reviews.filter((r) => r.approval !== 'PENDING' && r.approval !== 'REJECTED');
  const tagCount = new Map<string, number>();
  for (const r of ok) for (const t of r.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const clip = (s: string) => (s.length > QUOTE_MAX ? `${s.slice(0, QUOTE_MAX - 1).trimEnd()}…` : s);
  return {
    name: profile.displayName,
    place: profile.location.place || profile.location.municipality,
    jobs: profile.completedTasks ?? 0,
    rating: profile.rating?.count ? profile.rating : undefined,
    memberSince: profile.memberSince,
    showsUp,
    categories: [...jobs]
      .filter((j) => j.jobs > 0)
      .sort((a, b) => b.jobs - a.jobs)
      .map((j) => ({ label: categoryLabel(categoryArtId(j.categorySlug)), jobs: j.jobs })),
    tags: [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, TAGS).map(([label, count]) => ({ label, count })),
    quotes: ok
      .filter((r) => r.comment?.trim())
      .sort((a, b) => b.rating - a.rating || Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, QUOTES)
      .map((r) => ({ text: clip(r.comment!.trim()), stars: r.rating, when: monthYear(r.createdAt) })),
    madeAt: longDate(now.toISOString()),
  };
}

/** «Attest fra MinNabo» on the youth profile (0101): a PDF from the finished jobs and reviews. */
export function AttestCard({ profile }: { profile: PublicProfile }) {
  const reviews = useReviews(profile.id).data ?? [];
  const jobs = useCategoryJobs(profile.id).data ?? [];
  const reliability = useReliability(profile.id).data;
  const [busy, setBusy] = useState(false);
  const done = profile.completedTasks ?? 0;
  const t = nb.attest;

  const make = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const html = attestPdfHtml(attestInput(profile, reviews, jobs, reliability?.showsUp, new Date()));
      await sharePdf(html, t.filename(profile.displayName));
    } catch {
      toast.error(t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.row}>
        <View style={styles.disc}>
          <Icon name="file" size={20} color={colors.ink} />
        </View>
        <View style={styles.flex}>
          <Text style={text.label}>{t.cardTitle}</Text>
          <Text style={text.meta}>{done ? t.cardSub : t.empty}</Text>
        </View>
      </View>
      {done ? <Button label={busy ? t.working : t.cta} icon="download" variant="ink" size="sm" loading={busy} onPress={() => void make()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: radius.card, backgroundColor: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  disc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
});
