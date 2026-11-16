import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useMyNabolag, useNoticeboard } from '@/api/queries';
import { useMyWaves, useNabolagDetails, useSetNabolagIntro, useSetNabolagRules, useWave } from '@/api/communityQueries';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { postedAgo } from '@/lib/datetime';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Avatar, Button, Icon, Input, Note, Pill, Toggle } from '@/components/ui';
import { FellesPage, PageLabel, TONES } from '@/components/community/FellesPage';

const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'N';

/** «Om nabolaget»: husregler (verter edit), verter, my one-line introduction, new neighbours and pinned oppslag. */
export function NabolagInfoScreen({ nabolagId }: { nabolagId: string }) {
  const hood = (useMyNabolag().data ?? []).find((n) => n.id === nabolagId);
  const details = useNabolagDetails(nabolagId).data;
  const posts = useNoticeboard().data ?? [];
  const pinned = posts.filter((p) => p.neighbourhoodId === nabolagId && p.pinnedAt);
  const saveRules = useSetNabolagRules(nabolagId);
  const saveIntro = useSetNabolagIntro(nabolagId);
  const waves = useMyWaves().data ?? [];
  const wave = useWave();
  const [rules, setRules] = useState('');
  const [editRules, setEditRules] = useState(false);
  const [intro, setIntro] = useState('');
  const [showNew, setShowNew] = useState(false);
  // the saved values, once they arrive
  const [seeded, setSeeded] = useState(false);
  if (details && !seeded) {
    setSeeded(true);
    setRules(details.rules);
    setIntro(details.myIntro ?? '');
    setShowNew(!!details.myShowAsNew);
  }
  const place = hood?.place ?? '';
  const member = details?.myIntro !== null && details?.myIntro !== undefined;

  return (
    <FellesPage title={nb.felles.nabolag.infoTitle(place)} icon="home" tone={TONES.lime} testID="nabolag-info">
      <PageLabel>{nb.felles.nabolag.rulesTitle}</PageLabel>
      <View style={[styles.card, shadow.card]}>
        {editRules ? (
          <>
            <Input value={rules} onChangeText={setRules} maxLength={1200} multiline placeholder={nb.felles.nabolag.rulesPh} accessibilityLabel={nb.felles.nabolag.rulesTitle} />
            <Button
              label={nb.common.save}
              variant="lime"
              size="sm"
              block={false}
              loading={saveRules.isPending}
              onPress={() =>
                saveRules.mutate(rules, {
                  onSuccess: () => {
                    toast.success(nb.felles.nabolag.rulesSaved);
                    setEditRules(false);
                  },
                  onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
                })
              }
            />
          </>
        ) : (
          <>
            <Text style={[text.body, styles.ink2]}>{details?.rules || nb.felles.nabolag.rulesEmpty}</Text>
            {details?.iAmHost ? <Button label={nb.felles.nabolag.rulesEdit} variant="ghost" size="sm" block={false} icon="edit" onPress={() => setEditRules(true)} /> : null}
          </>
        )}
      </View>

      <PageLabel>{nb.felles.nabolag.hostsTitle}</PageLabel>
      <View style={[styles.card, shadow.card]}>
        <Text style={text.meta}>{nb.felles.nabolag.hostsSub}</Text>
        {details?.hosts.length ? (
          <View style={styles.hosts}>
            {details.hosts.map((h) => (
              <View key={h.id} style={styles.host}>
                <Avatar initials={initials(h.name)} seed={h.id} size={36} ring={false} />
                <Text style={styles.name}>{h.name}</Text>
                <Pill label={nb.felles.nabolag.hostBadge} tone="accent" size="sm" icon="award" />
              </View>
            ))}
          </View>
        ) : (
          <Text style={text.meta}>{nb.felles.nabolag.hostsNone}</Text>
        )}
        {details?.iAmHost ? <Pill label={nb.felles.nabolag.youAreHost} tone="ok" icon="check" size="sm" /> : null}
      </View>

      {member ? (
        <>
          <PageLabel>{nb.felles.nabolag.introTitle}</PageLabel>
          <View style={[styles.card, shadow.card]}>
            <Text style={text.meta}>{nb.felles.nabolag.introSub}</Text>
            <Input value={intro} onChangeText={setIntro} maxLength={140} placeholder={nb.felles.nabolag.introPh} accessibilityLabel={nb.felles.nabolag.introTitle} />
            <View style={styles.toggleRow}>
              <View style={styles.flex}>
                <Text style={styles.name}>{nb.felles.nabolag.showAsNew}</Text>
                <Text style={text.hint}>{nb.felles.nabolag.showAsNewSub}</Text>
              </View>
              <Toggle value={showNew} onValueChange={setShowNew} accessibilityLabel={nb.felles.nabolag.showAsNew} />
            </View>
            <Button
              label={nb.common.save}
              variant="lime"
              size="sm"
              block={false}
              loading={saveIntro.isPending}
              onPress={() =>
                saveIntro.mutate(
                  { intro, showAsNew: showNew },
                  { onSuccess: () => toast.success(nb.felles.nabolag.introSaved), onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)) },
                )
              }
            />
          </View>
        </>
      ) : null}

      <PageLabel>{nb.felles.nabolag.newTitle}</PageLabel>
      {details?.newMembers.length ? (
        details.newMembers.map((p) => {
          const said = waves.includes(p.id);
          return (
            <View key={p.id} style={[styles.member, shadow.card]}>
              <Avatar initials={initials(p.name)} seed={p.id} size={42} ring={false} />
              <View style={styles.flex}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={text.meta} numberOfLines={2}>
                  {p.intro || nb.felles.nabolag.joined(postedAgo(p.joinedAt))}
                </Text>
              </View>
              <Button
                label={said ? nb.felles.nabolag.saidHi : nb.felles.nabolag.sayHi}
                variant={said ? 'soft' : 'lime'}
                size="sm"
                block={false}
                disabled={said}
                accessibilityLabel={nb.felles.nabolag.sayHiA11y(p.name)}
                onPress={() =>
                  wave.mutate(
                    { nabolagId, profileId: p.id },
                    {
                      onSuccess: () => {
                        haptics.success();
                        toast.success(nb.felles.nabolag.hiSent(p.name));
                      },
                      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
                    },
                  )
                }
              />
            </View>
          );
        })
      ) : (
        <Note icon="users">{nb.felles.nabolag.newNone}</Note>
      )}

      {pinned.length ? (
        <>
          <PageLabel>{nb.felles.nabolag.pinnedTitle}</PageLabel>
          {pinned.map((p) => (
            <Pressable key={p.id} accessibilityRole="link" onPress={() => safePush(`/oppslagstavle?oppslag=${p.id}`)} style={[styles.member, shadow.card]}>
              <Icon name="pinned" size={18} color={colors.limeDeep} />
              <Text style={[styles.name, styles.flex]} numberOfLines={2}>
                {p.title}
              </Text>
              <Icon name="right" size={16} color={colors.faint} />
            </Pressable>
          ))}
        </>
      ) : null}
    </FellesPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ink2: { color: colors.ink2 },
  card: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, gap: 10, alignItems: 'flex-start' },
  hosts: { gap: 8, alignSelf: 'stretch' },
  host: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 60, borderRadius: radius.card, backgroundColor: colors.surface },
});
