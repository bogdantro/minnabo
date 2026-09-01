import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatFriendlyDate } from '@/lib/calendar';
import { BottomSheet } from './ui/BottomSheet';
import { DateField } from './ui/DateField';
import { TimeField } from './ui/TimeField';
import { Button } from './ui/Button';

export function TimeProposalSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const submit = () => {
    if (!date) return;
    const when = formatFriendlyDate(date);
    const text = time ? `📅 ${nb.chat.timeSuggestion}: ${when} kl. ${time}` : `📅 ${nb.chat.timeSuggestion}: ${when}`;
    onSubmit(text);
    onClose();
    setDate(null);
    setTime(null);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={nb.chat.proposeTime} heightRatio={0.55}>
      <View style={styles.body}>
        <DateField label={nb.proposalForm.whenLabel} value={date} onChange={setDate} />
        <TimeField label={nb.common.time} value={time} onChange={setTime} />
        <Button label={nb.chat.sendSuggestion} onPress={submit} iconRight="send" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: tokens.space.md, paddingTop: tokens.space.sm },
});
