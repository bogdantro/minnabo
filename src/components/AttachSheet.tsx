import { useState } from 'react';
import { View, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { pickAndUpload } from '@/lib/uploads';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { BottomSheet } from './ui/BottomSheet';

const STOCK = [
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=400&q=60',
  'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=400&q=60',
  'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=400&q=60',
  'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=60',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=60',
  'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=60',
];

export function AttachSheet({
  visible,
  onClose,
  onPick,
  folder,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  /** storage folder — must start with the current user id */
  folder: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (source: 'camera' | 'library') => {
    setError(null);
    setBusy(true);
    try {
      const res = await pickAndUpload({ bucket: 'chat-attachments', folder, source });
      if (res) {
        onPick(res.publicUrl);
        onClose();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={nb.attachSheet.title} heightRatio={0.62}>
      <AppText variant="meta" color="navyMuted" style={styles.intro}>
        {nb.attachSheet.intro}
      </AppText>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.attachSheet.take}
          disabled={busy}
          onPress={() => run('camera')}
          style={styles.action}
        >
          <Icon name="camera" size={16} color="cyan" />
          <AppText variant="meta" weight="bold" color="cyan">
            {nb.attachSheet.take}
          </AppText>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.attachSheet.library}
          disabled={busy}
          onPress={() => run('library')}
          style={styles.action}
        >
          <Icon name="image" size={16} color="cyan" />
          <AppText variant="meta" weight="bold" color="cyan">
            {nb.attachSheet.library}
          </AppText>
        </Pressable>
      </View>

      {busy ? <ActivityIndicator color={tokens.color.cyan} style={styles.spin} /> : null}
      {error ? (
        <AppText variant="meta" color="dangerText" style={styles.intro}>
          {error}
        </AppText>
      ) : null}

      <AppText variant="meta" color="navyMuted" style={styles.intro}>
        {nb.attachSheet.examples}
      </AppText>
      <View style={styles.grid}>
        {STOCK.map((url) => (
          <Pressable
            key={url}
            accessibilityRole="button"
            accessibilityLabel={nb.attachSheet.library}
            onPress={() => {
              onPick(url);
              onClose();
            }}
            style={styles.cell}
          >
            <Image source={{ uri: url }} style={styles.img} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: tokens.space.md },
  spin: { marginBottom: tokens.space.md },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.lg,
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.tile,
    paddingVertical: tokens.space.md,
    marginBottom: tokens.space.md,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { width: 1, height: 16, backgroundColor: tokens.color.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  cell: { width: '31%', aspectRatio: 1 },
  img: { width: '100%', height: '100%', borderRadius: tokens.radius.md },
});
