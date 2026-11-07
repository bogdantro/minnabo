import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMyPoliceCertificate, useSubmitPoliceCertificate } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { serverMessage } from '@/lib/errors';
import { pickAndUpload } from '@/lib/uploads';
import { toast } from '@/lib/toast';
import nb from '@/i18n/nb';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button, Icon, Note, Pill } from '@/components/ui';

/**
 * Politiattest on Verifisering, behind the flag policeCertificate. The file goes to a private
 * bucket, is read once by a moderator and then deleted: only «sett» and the date are kept (0091).
 */
export function PoliceCertificateCard() {
  const me = useCurrentUser();
  const { data } = useMyPoliceCertificate(!me.isYouth);
  const submit = useSubmitPoliceCertificate();
  const [busy, setBusy] = useState(false);
  if (me.isYouth) return null;
  const status = data?.status ?? 'NONE';

  const upload = async () => {
    setBusy(true);
    try {
      const r = await pickAndUpload({ bucket: 'police-certificates', folder: me.id, source: 'library' });
      if (r) {
        await submit.mutateAsync(r.path);
        toast.success(nb.police.sent, { icon: 'check' });
      }
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon name="shield" size={20} color={colors.ok} />
        </View>
        <View style={styles.flex}>
          <Text style={text.label}>{nb.police.title}</Text>
          <Text style={text.meta}>{nb.police.sub}</Text>
        </View>
        {status !== 'NONE' ? <Pill label={nb.police.status[status]} tone={status === 'APPROVED' ? 'ok' : status === 'REJECTED' ? 'danger' : 'warn'} /> : null}
      </View>
      {status === 'REJECTED' && data?.rejectionReason ? <Text style={text.meta}>{data.rejectionReason}</Text> : null}
      {status === 'NONE' || status === 'REJECTED' ? (
        <>
          <Button label={nb.police.upload} icon="image" variant="ghost" size="sm" loading={busy} onPress={() => void upload()} />
          <Note icon="lock">{nb.police.privacy}</Note>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.okTint, alignItems: 'center', justifyContent: 'center' },
});
