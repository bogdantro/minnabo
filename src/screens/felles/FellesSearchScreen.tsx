import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { useNoticeboard, usePartners } from '@/api/queries';
import { useOrganisations, useProjects } from '@/api/communityQueries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { safePush } from '@/lib/nav';
import { noticeLook } from '@/components/community/noticeKinds';
import type { NoticeboardPost } from '@/domain/types';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Icon, Screen, SubHeader, type IconName } from '@/components/ui';

type Hit = { key: string; title: string; sub: string; icon: IconName; bg: string; fg: string; to: string };

const norm = (v: string) => v.toLowerCase().normalize('NFC');

/** «Søk i Fellesskap»: one field across oppslag, arrangementer, lag, partnere and prosjekter in my kommune. */
export function FellesSearchScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { municipality, municipalities } = useLocationScope();
  const kommune = me.municipality || municipality || '';
  const [q, setQ] = useState('');
  const postsData = useNoticeboard().data;
  const partnersData = usePartners().data;
  const orgsData = useOrganisations(kommune).data;
  const projectsData = useProjects(kommune).data;
  const needle = norm(q.trim());

  const groups = useMemo(() => {
    if (needle.length < 2) return [];
    const posts = postsData ?? [];
    const partners = partnersData ?? [];
    const orgs = orgsData ?? [];
    const projects = projectsData ?? [];
    const has = (...parts: (string | undefined)[]) => parts.some((p) => p && norm(p).includes(needle));
    const local = posts.filter((p) => !p.doneAt && (municipalities.length === 0 || municipalities.includes(p.municipality)));
    const toHit = (p: NoticeboardPost): Hit => {
      const look = noticeLook(p);
      return { key: p.id, title: p.title, sub: p.place || p.municipality, icon: look.icon, bg: look.bg, fg: look.fg, to: `/oppslagstavle?oppslag=${p.id}` };
    };
    return [
      { label: nb.felles.search.events, hits: local.filter((p) => p.eventType && has(p.title, p.body)).map(toHit) },
      { label: nb.felles.search.notices, hits: local.filter((p) => !p.eventType && has(p.title, p.body)).map(toHit) },
      {
        label: nb.felles.search.orgs,
        hits: orgs.filter((o) => has(o.name, o.about)).map((o) => ({ key: o.id, title: o.name, sub: nb.felles.orgs.kinds[o.kind], icon: 'award' as IconName, bg: colors.limeTint, fg: colors.limeDeep, to: `/foreninger?vis=${o.id}` })),
      },
      {
        label: nb.felles.search.partners,
        hits: partners
          .filter((p) => has(p.name, p.tagline, p.offer, p.about))
          .map((p) => ({ key: p.id, title: p.name, sub: p.tagline, icon: 'building' as IconName, bg: colors.cyanTint, fg: colors.cyanDeep, to: `/partner/${p.id}` })),
      },
      {
        label: nb.felles.search.projects,
        hits: projects
          .filter((p) => has(p.title, p.body))
          .map((p) => ({ key: p.id, title: p.title, sub: nb.felles.projects.kinds[p.kind], icon: 'hand' as IconName, bg: colors.okTint, fg: colors.okText, to: `/prosjekter?vis=${p.id}` })),
      },
    ].filter((g) => g.hits.length);
  }, [needle, postsData, municipalities, orgsData, partnersData, projectsData]);

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.felles.search.title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/fellesskap'))} />}>
      <View style={styles.px}>
        <View style={[styles.search, shadow.card]}>
          <Icon name="search" size={18} color={colors.mute} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder={nb.felles.search.ph}
            placeholderTextColor={colors.mute}
            accessibilityLabel={nb.felles.search.a11y}
            returnKeyType="search"
            style={styles.input}
          />
          {q ? (
            <Pressable accessibilityRole="button" accessibilityLabel={nb.inbox.clear} onPress={() => setQ('')} style={styles.clear}>
              <Icon name="x" size={14} color={colors.ink2} />
            </Pressable>
          ) : null}
        </View>
        {needle.length < 2 ? (
          <Text style={[text.meta, styles.hint]}>{nb.felles.search.start}</Text>
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={text.h3}>{nb.felles.search.empty(q.trim())}</Text>
            <Text style={text.meta}>{nb.felles.search.emptySub}</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.label} style={styles.group}>
              <Text style={styles.groupLabel}>{`${g.label} · ${g.hits.length}`}</Text>
              {g.hits.slice(0, 20).map((h) => (
                <Pressable key={h.key} accessibilityRole="link" accessibilityLabel={`${h.title}, ${h.sub}`} onPress={() => safePush(h.to)} style={[styles.row, shadow.card]}>
                  <View style={[styles.icon, { backgroundColor: h.bg }]}>
                    <Icon name={h.icon} size={16} color={h.fg} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.title} numberOfLines={1}>
                      {h.title}
                    </Text>
                    {h.sub ? (
                      <Text style={text.hint} numberOfLines={1}>
                        {h.sub}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="right" size={16} color={colors.faint} />
                </Pressable>
              ))}
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding, paddingBottom: 40 },
  flex: { flex: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, marginTop: 10, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  hint: { marginTop: 18, textAlign: 'center' },
  empty: { marginTop: 30, gap: 6, alignItems: 'center' },
  group: { marginTop: 20, gap: 8 },
  groupLabel: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.3, textTransform: 'uppercase', color: colors.mute },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 60, borderRadius: radius.tile, backgroundColor: colors.surface },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
});
