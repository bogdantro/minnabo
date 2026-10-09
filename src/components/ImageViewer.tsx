import { Image, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import { colors } from '@/theme/theme';
import { IconButton } from './ui';

/**
 * A photo in fullscreen: the whole picture on a dark background, pinch to zoom
 * (iOS), tap the picture or the X to close. Used for photos in a chat.
 */
export function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar style="light" />
      <View style={styles.bg}>
        {uri ? (
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            bouncesZoom
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.center}
          >
            <Pressable accessibilityRole="imagebutton" accessibilityLabel={nb.chat.imageClose} onPress={onClose}>
              <Image source={{ uri }} style={{ width, height }} resizeMode="contain" accessibilityIgnoresInvertColors />
            </Pressable>
          </ScrollView>
        ) : null}
        <View style={[styles.close, { top: insets.top + 8 }]}>
          <IconButton icon="x" variant="glass" accessibilityLabel={nb.chat.imageClose} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.viewerBg },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', right: 16 },
});
