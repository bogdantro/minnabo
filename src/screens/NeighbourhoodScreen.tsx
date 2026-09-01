import { useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useNeighbourhood } from '@/lib/neighbourhood';
import { useListings, useNoticeboard } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ListingRowCard } from '@/components/ListingRowCard';

export function NeighbourhoodScreen() {
  const me = useCurrentUser();
  const { group, members, join, leave } = useNeighbourhood();
  const [name, setName] = useState('');

  const listings = useListings({}, 'NEWEST');
  const notices = useNoticeboard();

  const local = useMemo(() => {
    const place = (me.place ?? '').toLowerCase();
    return (listings.data ?? [])
      .filter((l) => !place || l.location.place.toLowerCase().includes(place))
      .slice(0, 5);
  }, [listings.data, me.place]);

  const localNotices = useMemo(() => {
    const place = (me.place ?? '').toLowerCase();
    return (notices.data ?? [])
      .filter((n) => !place || n.place.toLowerCase().includes(place))
      .slice(0, 3);
  }, [notices.data, me.place]);

  const doLeave = async () => {
    if (await confirm({ title: nb.neighbourhood.leaveConfirm, destructive: true, confirmLabel: nb.neighbourhood.leave })) {
      leave();
      toast.info(nb.neighbourhood.left);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.neighbourhood.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.neighbourhood.title}</ScreenTitle>

        {!group ? (
          <View style={styles.card}>
            <AppText variant="body" color="navyMuted">
              {nb.neighbourhood.joinBody}
            </AppText>
            <TextField
              label={nb.neighbourhood.nameLabel}
              value={name}
              onChangeText={setName}
              placeholder={nb.neighbourhood.namePlaceholder}
            />
            <Button
              label={nb.neighbourhood.join}
              onPress={() => {
                if (!name.trim()) return;
                join(name);
                toast.success(nb.neighbourhood.joined);
              }}
            />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.groupHead}>
              <Icon name="home" size={18} color="lime" />
              <AppText variant="cardTitle" weight="bold">
                {group}
              </AppText>
            </View>
            <AppText variant="meta" color="navyMuted">
              {nb.neighbourhood.memberCount(members)}
            </AppText>
            <Button label={nb.neighbourhood.leave} variant="ghost" iconLeft="log-out" onPress={doLeave} />
          </View>
        )}

        <View style={styles.section}>
          <AppText variant="meta" weight="bold" color="navyMuted">
            {nb.neighbourhood.localTasks.toUpperCase()}
          </AppText>
          {local.length === 0 ? (
            <AppText variant="body" color="navyMuted">
              {nb.neighbourhood.noLocal}
            </AppText>
          ) : (
            local.map((l) => (
              <ListingRowCard key={l.id} listing={l} onPress={() => safePush(`/oppdrag/${l.id}`)} />
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <AppText variant="meta" weight="bold" color="navyMuted">
              {nb.neighbourhood.localNotices.toUpperCase()}
            </AppText>
            <AppText variant="meta" weight="bold" color="cyan" onPress={() => safePush('/oppslagstavle')}>
              {nb.common.seeAll}
            </AppText>
          </View>
          {localNotices.map((n) => (
            <View key={n.id} style={styles.notice}>
              <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
                {n.title}
              </AppText>
              <AppText variant="meta" color="navyMuted" numberOfLines={2}>
                {n.body}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxxl },
  card: {
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.lg,
    ...tokens.shadow.card,
  },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  section: { gap: tokens.space.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notice: {
    gap: 2,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.tile,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
  },
});
