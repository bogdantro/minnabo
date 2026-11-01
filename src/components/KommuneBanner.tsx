import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import nb from '@/i18n/nb';
import { useSession } from '@/auth/session';
import { useProfile, useUpdateProfile } from '@/api/queries';
import { LAUNCH_KOMMUNER } from '@/data/kommuner';
import { detectKommune, locationErrorText } from '@/lib/geo';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, text } from '@/theme/theme';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { Sheet } from './ui/Sheet';

/** Oppsett asks for the kommune itself; the banner would only be in the way there. */
const ONBOARDING = ['/velkommen', '/logg-inn', '/vipps', '/samtykker', '/oppsett', '/suspendert'];

/**
 * Shown under the header of every screen (Screen in ui/Layout) while the signed-in
 * profile has no kommune – the feed, Legg ut and Nabolag all depend on it, so it can't be
 * dismissed, only fixed. The database refuses to empty a kommune again (0073).
 */
export function KommuneBanner() {
  const { userId, status } = useSession();
  const pathname = usePathname();
  const profile = useProfile(status === 'authed' ? (userId ?? '') : '');
  const update = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  // only when the profile is really loaded – an error or a slow network is not "no kommune"
  const missing = !!profile.data && !profile.data.location.municipality?.trim();
  if (!missing || ONBOARDING.some((p) => pathname.startsWith(p))) return null;

  const choose = (k: string, place = k) =>
    update.mutate(
      { municipality: k, place },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success(nb.kommuneBanner.saved(k), { icon: 'pin' });
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    const res = await detectKommune();
    setLocating(false);
    if ('municipality' in res) choose(res.municipality, res.place || res.municipality);
    else toast.error(locationErrorText(res.error));
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${nb.kommuneBanner.title}. ${nb.kommuneBanner.body}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        testID="kommune-banner"
      >
        <View style={styles.icon}>
          <Icon name="pin" size={16} color={colors.warn} />
        </View>
        <View style={styles.flex}>
          <Text style={[text.label, styles.title]}>{nb.kommuneBanner.title}</Text>
          <Text style={[text.meta, styles.body]}>{nb.kommuneBanner.body}</Text>
        </View>
        <View style={styles.cta}>
          <Text style={[text.pill, { color: colors.white }]}>{nb.kommuneBanner.cta}</Text>
        </View>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={nb.kommuneBanner.sheetTitle} scroll heightRatio={0.7}>
        <Text style={[text.meta, styles.sheetSub]}>{nb.kommuneBanner.sheetSub}</Text>
        <Button
          label={locating ? nb.oppdrag.locating : nb.oppdrag.useLocation}
          icon={locating ? undefined : 'locate'}
          variant="ink"
          loading={locating}
          onPress={locate}
          style={styles.locate}
        />
        {LAUNCH_KOMMUNER.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k}
            disabled={update.isPending}
            onPress={() => choose(k)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Icon name="building" size={18} color={colors.mute} />
            <Text style={[text.body, styles.flex]}>{k}</Text>
            <Icon name="arrow" size={16} color={colors.mute} />
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: screenPadding,
    marginTop: 6,
    marginBottom: 6,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.warn,
    backgroundColor: colors.warnTint,
  },
  pressed: { opacity: 0.75 },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, lineHeight: 18, color: colors.warnDark },
  body: { color: colors.warnDark },
  cta: { minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sheetSub: { marginBottom: 12 },
  locate: { marginBottom: 8 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line2 },
});
