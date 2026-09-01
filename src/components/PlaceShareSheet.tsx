import { useState } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { BottomSheet } from './ui/BottomSheet';
import { TextField } from './ui/TextField';
import { Button } from './ui/Button';
import { AppText } from './ui/Text';

/** Build a maps URL the recipient's OS can open (no native map needed). */
function mapsUrl(query: string): string {
  const q = encodeURIComponent(query);
  return Platform.OS === 'ios' ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function PlaceShareSheet({
  visible,
  onClose,
  defaultPlace,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  defaultPlace?: string;
  onSubmit: (text: string) => void;
}) {
  const [place, setPlace] = useState(defaultPlace ?? '');

  const submit = () => {
    const trimmed = place.trim();
    if (!trimmed) return;
    onSubmit(`📍 ${nb.chat.meetingPoint}: ${trimmed}\n${mapsUrl(trimmed)}`);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={nb.chat.sharePlace} heightRatio={0.42}>
      <View style={styles.body}>
        <AppText variant="meta" color="navyMuted">
          {nb.chat.sharePlaceHint}
        </AppText>
        <TextField
          label={nb.chat.meetingPoint}
          value={place}
          onChangeText={setPlace}
          placeholder="F.eks. Storgata 1, Lillehammer"
        />
        <Button label={nb.chat.sendSuggestion} onPress={submit} iconRight="send" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: tokens.space.md, paddingTop: tokens.space.sm },
});
