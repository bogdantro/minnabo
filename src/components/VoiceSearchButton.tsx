/**
 * The microphone in Søk's search field (0110): say «snømåking i helgen» instead of typing it.
 * Norwegian speech recognition on the phone (and in browsers that have it); hidden where there is none.
 */
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import nb from '@/i18n/nb';
import { toast } from '@/lib/toast';
import { colors, radius } from '@/theme/theme';
import { Icon } from '@/components/ui';

/** Is speech recognition there at all? A phone without it (or an old browser) shows no microphone. */
function available(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/** `final`: the person stopped talking, so this is the whole search. */
export function VoiceSearchButton({ onText }: { onText: (text: string, final: boolean) => void }) {
  const [listening, setListening] = useState(false);
  const [shown] = useState(available);

  useSpeechRecognitionEvent('result', (e) => {
    const said = e.results[0]?.transcript?.trim();
    if (said) onText(said, e.isFinal);
    if (e.isFinal) setListening(false);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    // «no-speech» and «aborted» are the person stopping; anything else is worth a word
    if (e.error !== 'aborted' && e.error !== 'no-speech') toast.error(nb.op.search.voiceFailed);
  });

  if (!shown) return null;

  const toggle = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      toast.error(nb.op.search.voiceDenied);
      return;
    }
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'nb-NO', interimResults: true, continuous: false });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listening ? nb.op.search.listening : nb.op.search.voice}
      accessibilityState={{ busy: listening }}
      onPress={() => void toggle()}
      hitSlop={6}
      style={[styles.btn, listening && styles.on]}
      testID="voice-search"
    >
      <Icon name="mic" size={18} color={listening ? colors.white : colors.ink2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.ink },
});
