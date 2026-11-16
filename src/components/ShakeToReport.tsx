import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import nb from '@/i18n/nb';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useShake } from '@/lib/shake';
import { toast } from '@/lib/toast';
import { uploadCaptured } from '@/lib/uploads';
import { colors, radius, text } from '@/theme/theme';
import { Button, Field, Input, ListRow, Note, Sheet, Toggle } from './ui';
import { Image } from './ui/Image';

const BODY_MAX = 1500;

/**
 * Shake the phone → «Meld fra om et problem» (asked 2026-11-09). A picture of the screen is taken at the
 * moment of the shake, so it shows what went wrong, and the person decides whether it goes along.
 * It lands in the MinNabo chat in Admin (0099 minnabo_report_problem), with the page and app version.
 */
export function ShakeToReport() {
  const { userId } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [withShot, setWithShot] = useState(true);
  const [body, setBody] = useState('');
  const [where, setWhere] = useState('');

  const onShake = useCallback(async () => {
    if (open) return;
    haptics.medium();
    setWhere(pathname);
    let uri: string | null = null;
    try {
      const { captureScreen } = await import('react-native-view-shot');
      uri = await captureScreen({ format: 'jpg', quality: 0.8, result: 'tmpfile' });
    } catch {
      uri = null; // no picture module in this build: the text still goes
    }
    setShot(uri);
    setWithShot(!!uri);
    setOpen(true);
  }, [open, pathname]);
  useShake(() => void onShake(), !!userId);

  const send = useMutation({
    mutationFn: async () => {
      const picture = withShot && shot && userId ? await uploadCaptured('report-attachments', userId, shot) : null;
      const version = Constants.expoConfig?.version ?? '';
      await apiClient.reportProblem({ body: body.trim(), imagePath: picture?.path, context: `${where} · ${Platform.OS} ${version}` });
    },
    onSuccess: () => {
      haptics.success();
      setOpen(false);
      setBody('');
      setShot(null);
      toast.success(nb.shakeReport.sent, { icon: 'check' });
    },
    onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
  });

  if (!userId) return null;
  const tooShort = body.trim().length < 3;

  return (
    <Sheet visible={open} onClose={() => setOpen(false)} title={nb.shakeReport.title} subtitle={nb.shakeReport.sub} titleSize="h2" scroll>
      <Field label={nb.shakeReport.label} hint={`${body.length}/${BODY_MAX}`}>
        <Input
          value={body}
          onChangeText={(v) => setBody(v.slice(0, BODY_MAX))}
          placeholder={nb.shakeReport.ph}
          multiline
          accessibilityLabel={nb.shakeReport.label}
          style={styles.input}
          testID="shake-report-text"
        />
      </Field>
      {shot ? (
        <View style={styles.shotRow}>
          <Image source={{ uri: shot }} style={[styles.shot, !withShot && styles.shotOff]} resizeMode="cover" accessibilityLabel={nb.shakeReport.shotA11y} />
          <View style={styles.flex}>
            <ListRow
              title={nb.shakeReport.withShot}
              subtitle={nb.shakeReport.withShotSub}
              right={<Toggle value={withShot} onValueChange={setWithShot} accessibilityLabel={nb.shakeReport.withShot} />}
            />
          </View>
        </View>
      ) : null}
      <Note icon="info" style={styles.note}>
        {nb.shakeReport.note}
      </Note>
      <Button label={nb.shakeReport.send} icon="send" size="lg" disabled={tooShort} loading={send.isPending} onPress={() => send.mutate()} style={styles.btn} testID="shake-report-send" />
      <Text style={[text.hint, styles.off]}>{nb.shakeReport.offHint}</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 110, textAlignVertical: 'top' },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  shot: { width: 64, height: 120, borderRadius: radius.s, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.track },
  shotOff: { opacity: 0.35 },
  flex: { flex: 1, minWidth: 0 },
  note: { marginTop: 16 },
  btn: { marginTop: 18 },
  off: { textAlign: 'center', marginTop: 10 },
});
