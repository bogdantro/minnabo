import { useState } from 'react';
import { View, Image, ScrollView, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatFriendlyDate } from '@/lib/calendar';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { TextField } from './ui/TextField';
import { DateField } from './ui/DateField';
import { TimeField } from './ui/TimeField';
import { Button } from './ui/Button';
import { InfoBox } from './ui/InfoBox';
import { BottomSheet } from './ui/BottomSheet';

export type OfferDraft = {
  priceAmountMinor: number;
  scheduledText?: string;
  message?: string;
  caveats?: string;
};

export function SendOfferSheet({
  visible,
  onClose,
  listingTitle,
  listingImageUrl,
  onSubmit,
  pending,
}: {
  visible: boolean;
  onClose: () => void;
  listingTitle: string;
  listingImageUrl?: string;
  onSubmit: (draft: OfferDraft) => void;
  pending?: boolean;
}) {
  const [price, setPrice] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [caveats, setCaveats] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const kr = Number(price.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(kr) || kr <= 0) {
      setError(nb.sendOfferSheet.priceRequired);
      return;
    }
    setError(null);
    const scheduledText = [date ? formatFriendlyDate(date) : null, time ? `kl. ${time}` : null]
      .filter(Boolean)
      .join(' ');
    onSubmit({
      priceAmountMinor: Math.round(kr * 100),
      scheduledText: scheduledText || undefined,
      message: message.trim() || undefined,
      caveats: caveats.trim() || undefined,
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={nb.sendOfferSheet.title} heightRatio={0.85}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.listingRow}>
          {listingImageUrl ? (
            <Image source={{ uri: listingImageUrl }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback]}>
              <Icon name="clipboard" size={18} color="navyMuted" />
            </View>
          )}
          <AppText variant="cardTitle" weight="bold" numberOfLines={2} style={styles.listingTitle}>
            {listingTitle}
          </AppText>
        </View>

        <AppText variant="meta" color="navyMuted">
          {nb.sendOfferSheet.intro}
        </AppText>

        <TextField
          label={nb.sendOfferSheet.priceLabel}
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          placeholder="600"
        />
        <View style={styles.whenRow}>
          <View style={styles.whenCell}>
            <DateField label={nb.sendOfferSheet.whenLabel} value={date} onChange={setDate} />
          </View>
          <View style={styles.whenTime}>
            <TimeField label="Tid" value={time} onChange={setTime} />
          </View>
        </View>
        <TextField
          label={nb.sendOfferSheet.messageLabel}
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <TextField
          label={nb.sendOfferSheet.caveatsLabel}
          value={caveats}
          onChangeText={setCaveats}
          placeholder={nb.sendOfferSheet.caveatsPlaceholder}
        />

        {error ? (
          <AppText variant="meta" color="dangerText">
            {error}
          </AppText>
        ) : null}

        <InfoBox icon="shield">{nb.chat.paymentNote}</InfoBox>
      </ScrollView>

      <Button label={nb.sendOfferSheet.submit} onPress={submit} loading={pending} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: tokens.space.md, paddingBottom: tokens.space.md },
  listingRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  whenRow: { flexDirection: 'row', gap: tokens.space.md },
  whenCell: { flex: 2 },
  whenTime: { flex: 1 },
  thumb: { width: 48, height: 48, borderRadius: tokens.radius.sm, backgroundColor: tokens.color.line },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  listingTitle: { flex: 1 },
});
