import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Partner } from '@/domain/types';
import nb from '@/i18n/nb';
import { usePartnerHelperCode } from '@/api/queries';
import { dayMonthYear } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { logPartnerClick } from '@/lib/partnerStats';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Button, Icon, Note, Sheet, Spinner } from '@/components/ui';
import { Image } from '@/components/ui/Image';

/** A partner's offer that is still running (helper_offer_until is the last day). */
export function activeHelperOffers(partners: Partner[], today = new Date()): Partner[] {
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return partners.filter((p) => !!p.helperOffer && (!p.helperOfferUntil || p.helperOfferUntil >= day));
}

/**
 * «Fordeler for hjelpere» on Fellesskap (0101): what local businesses give neighbours who help.
 * The code is only handed out (by the database) to someone who has finished a job as a helper.
 */
export function HelperPerks({ partners, kommune }: { partners: Partner[]; kommune?: string }) {
  const [open, setOpen] = useState<Partner | null>(null);
  if (!partners.length) return null;
  return (
    <View style={styles.list}>
      {partners.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={nb.perks.a11y(p.name, p.helperOffer ?? '')}
          onPress={() => setOpen(p)}
          style={({ pressed }) => [styles.card, shadow.card, pressed && styles.pressed]}
        >
          <View style={styles.logo}>
            {p.logoUrl ? (
              <Image source={{ uri: p.logoUrl }} style={styles.logoImg} resizeMode="contain" accessibilityIgnoresInvertColors />
            ) : (
              <Icon name="building" size={20} color={colors.ink} />
            )}
          </View>
          <View style={styles.flex}>
            <Text style={styles.offer} numberOfLines={2}>
              {p.helperOffer}
            </Text>
            <Text style={text.meta} numberOfLines={1}>
              {[p.name, p.helperOfferUntil ? nb.perks.until(dayMonthYear(`${p.helperOfferUntil}T12:00:00`)) : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={styles.tag}>
            <Icon name="tag" size={14} color={colors.ink} />
          </View>
        </Pressable>
      ))}
      <PerkSheet partner={open} kommune={kommune} onClose={() => setOpen(null)} />
    </View>
  );
}

function PerkSheet({ partner, kommune, onClose }: { partner: Partner | null; kommune?: string; onClose: () => void }) {
  const code = usePartnerHelperCode(partner?.id ?? '', !!partner);
  const copy = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      haptics.success();
      toast.success(nb.perks.copied, { icon: 'copy' });
    } catch {
      toast.error(nb.toast.genericError);
    }
  };
  return (
    <Sheet visible={!!partner} onClose={onClose} title={partner?.name ?? ''} titleSize="h2" subtitle={partner?.helperOffer}>
      {partner ? (
        <View style={styles.sheet}>
          {code.isLoading ? (
            <Spinner />
          ) : code.data ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>{nb.perks.codeLabel}</Text>
              <Text style={styles.code} selectable accessibilityLabel={nb.perks.codeA11y(code.data)}>
                {code.data}
              </Text>
              <Button label={nb.perks.copy} icon="copy" variant="ink" size="sm" onPress={() => void copy(code.data!)} />
            </View>
          ) : (
            <Note icon="lock">{nb.perks.locked}</Note>
          )}
          {partner.helperOfferUntil ? <Text style={text.meta}>{nb.perks.until(dayMonthYear(`${partner.helperOfferUntil}T12:00:00`))}</Text> : null}
          {partner.url ? (
            <Button
              label={nb.perks.visit}
              icon="arrowur"
              variant="ghost"
              onPress={() => {
                logPartnerClick(partner.id, kommune);
                void Linking.openURL(partner.url!);
              }}
            />
          ) : null}
          <Text style={styles.fine}>{nb.perks.fine}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { transform: [{ scale: 0.985 }] },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.white },
  logo: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 36, height: 36 },
  offer: { ...text.label, fontSize: 15 },
  tag: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  sheet: { gap: 14 },
  codeBox: { alignItems: 'center', gap: 8, padding: 18, borderRadius: radius.card, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.limeDeep, backgroundColor: colors.limeTint },
  codeLabel: { ...text.meta, color: colors.limeDeep },
  code: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 3, color: colors.ink },
  fine: { ...text.meta, fontSize: 12.5 },
});
