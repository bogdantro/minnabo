import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { BuddyProgram, BuddyRole } from '@/domain/community';
import { useBuddySignup, useBuddySignups, useLeaveBuddy } from '@/api/communityQueries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Button, Icon, Input, Note, OptionCard, type IconName } from '@/components/ui';
import { FellesPage, TONES } from '@/components/community/FellesPage';

const NOTE_MAX = 300;

/**
 * «Bli kjent med en nabo»: Språkvenn (everyone) and Vennetjenesten (adults). Sign-ups go to MinNabo, who pairs
 * people by hand and writes in the MinNabo thread – nobody can browse who signed up.
 */
export function BuddiesScreen() {
  const me = useCurrentUser();
  const mine = useBuddySignups().data ?? [];
  return (
    <FellesPage title={nb.felles.buddies.title} lead={nb.felles.buddies.lead} icon="smile" tone={TONES.ok} testID="buddies">
      <Program program="SPRAKVENN" icon="globe" title={nb.felles.buddies.sprakTitle} body={nb.felles.buddies.sprakBody} roles={nb.felles.buddies.roleSprak} signup={mine.find((m) => m.program === 'SPRAKVENN')} />
      {me.isYouth ? (
        <Note icon="info">{nb.felles.buddies.adultsOnly}</Note>
      ) : (
        <Program program="VENNETJENESTE" icon="home" title={nb.felles.buddies.vennTitle} body={nb.felles.buddies.vennBody} roles={nb.felles.buddies.roleVenn} signup={mine.find((m) => m.program === 'VENNETJENESTE')} />
      )}
      <Note icon="shield">{nb.felles.buddies.safety}</Note>
    </FellesPage>
  );
}

function Program({
  program,
  icon,
  title,
  body,
  roles,
  signup,
}: {
  program: BuddyProgram;
  icon: IconName;
  title: string;
  body: string;
  roles: { WANTS: string; GIVES: string };
  signup?: { role: BuddyRole; pairedAt?: string };
}) {
  const [role, setRole] = useState<BuddyRole>('WANTS');
  const [note, setNote] = useState('');
  const join = useBuddySignup();
  const leave = useLeaveBuddy();
  return (
    <View style={[styles.card, shadow.card]} testID={`buddy-${program}`}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon name={icon} size={18} color={colors.okText} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          <Text style={text.meta}>{body}</Text>
        </View>
      </View>
      {signup ? (
        <View style={styles.status}>
          <Icon name={signup.pairedAt ? 'checks' : 'hourglass'} size={16} color={colors.okText} />
          <View style={styles.flex}>
            <Text style={styles.statusTitle}>{`${nb.felles.buddies.signedUp} · ${roles[signup.role]}`}</Text>
            <Text style={text.meta}>{signup.pairedAt ? nb.felles.buddies.paired : nb.felles.buddies.waiting}</Text>
          </View>
          <Button
            label={nb.felles.buddies.leave}
            variant="text"
            size="sm"
            block={false}
            onPress={() => leave.mutate(program, { onSuccess: () => toast.success(nb.felles.buddies.leftToast) })}
          />
        </View>
      ) : (
        <>
          <View style={styles.roles} accessibilityRole="radiogroup">
            {(['WANTS', 'GIVES'] as BuddyRole[]).map((r) => (
              <OptionCard key={r} selected={role === r} onPress={() => setRole(r)} accessibilityLabel={roles[r]} style={styles.flex}>
                <Text style={styles.role}>{roles[r]}</Text>
              </OptionCard>
            ))}
          </View>
          <Input value={note} onChangeText={setNote} maxLength={NOTE_MAX} multiline placeholder={nb.felles.buddies.notePh} accessibilityLabel={nb.felles.buddies.notePh} />
          <Button
            label={nb.felles.buddies.signup}
            variant="lime"
            icon="check"
            loading={join.isPending}
            onPress={() =>
              join.mutate(
                { program, role, note: note.trim() },
                {
                  onSuccess: () => {
                    haptics.success();
                    toast.success(nb.felles.buddies.signedToast);
                    setNote('');
                  },
                  onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
                },
              )
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, gap: 12 },
  head: { flexDirection: 'row', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.okTint, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, color: colors.ink },
  roles: { flexDirection: 'row', gap: 10 },
  role: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19, color: colors.ink },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.tile, backgroundColor: colors.okTint },
  statusTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
});
