import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Icon } from '@/components/ui';

/** Longest talemelding (same limit as the 0077 check, which allows a little slack). */
export const VOICE_MAX_MS = 2 * 60 * 1000; // 2 minutes
/** Shorter than this is almost always a mis-tap, not a message. */
export const VOICE_MIN_MS = 1000; // 1 second
/** The timer turns red and counts down for the last stretch. */
const COUNTDOWN_MS = 15 * 1000;

// Speech, not music: mono at 64 kbit/s keeps a 2-minute clip around 1 MB.
const VOICE_OPTIONS: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 };

/** 7200 → "0:07", 83000 → "1:23". */
export function formatClip(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export type VoiceClip = { uri: string; durationMs: number };
export type StartResult = 'ok' | 'denied' | 'failed';

/**
 * Microphone for the chat composer. `start` asks for permission the first time; `finish`
 * returns the clip (or null when it was too short); `cancel` throws the recording away.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(VOICE_OPTIONS);
  const state = useAudioRecorderState(recorder, 200);
  const [active, setActive] = useState(false);

  // back to normal playback: while recording is allowed, iPhones play through the quiet earpiece
  const endSession = () => setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);

  const start = async (): Promise<StartResult> => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return 'denied';
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setActive(true);
      haptics.light();
      return 'ok';
    } catch {
      void endSession();
      return 'failed';
    }
  };

  const finish = async (): Promise<VoiceClip | null> => {
    const durationMs = Math.min(state.durationMillis, VOICE_MAX_MS);
    setActive(false);
    try {
      await recorder.stop();
    } finally {
      void endSession();
    }
    const uri = recorder.uri;
    return uri && durationMs >= VOICE_MIN_MS ? { uri, durationMs } : null;
  };

  const cancel = async () => {
    setActive(false);
    await recorder.stop().catch(() => undefined);
    void endSession();
  };

  return { active, elapsedMs: active ? state.durationMillis : 0, start, finish, cancel };
}

/**
 * Replaces the text field while recording: a pulsing dot, the time, «Avbryt» and send.
 * At 2 minutes the clip is sent by itself (`onSend` is called once).
 */
export function RecordingBar({ elapsedMs, onCancel, onSend }: { elapsedMs: number; onCancel: () => void; onSend: () => void }) {
  const left = VOICE_MAX_MS - elapsedMs;
  const sent = useRef(false);
  useEffect(() => {
    if (left <= 0 && !sent.current) {
      sent.current = true;
      onSend();
    }
  }, [left, onSend]);
  const ending = left <= COUNTDOWN_MS;
  return (
    <View style={styles.rec} testID="voice-recording">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.chat.voiceCancel}
        onPress={onCancel}
        hitSlop={6}
        style={({ pressed }) => [styles.recCancel, pressed && styles.pressed]}
      >
        <Icon name="trash" size={20} color={colors.danger} />
      </Pressable>
      <View style={styles.recMid} accessibilityRole="timer" accessibilityLabel={nb.chat.voiceTimerA11y(formatClip(elapsedMs))}>
        <PulseDot />
        <Text style={[styles.recTime, ending && { color: colors.danger }]}>{formatClip(elapsedMs)}</Text>
        <Text style={styles.recHint} numberOfLines={1}>
          {ending ? nb.chat.voiceLeft(formatClip(left)) : nb.chat.voiceRecording}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.chat.voiceSend}
        onPress={() => {
          if (sent.current) return;
          sent.current = true;
          onSend();
        }}
        style={({ pressed }) => [styles.recSend, shadow.btnLime, pressed && styles.pressed]}
      >
        <Icon name="send" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

function PulseDot() {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!reduced) o.set(withRepeat(withTiming(0.25, { duration: 700 }), -1, true));
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * A talemelding in the thread: play/pause, progress and the length. Nothing is loaded until
 * the first tap, so a long chat with many clips stays light.
 */
export function VoiceBubble({ uri, ms, mine }: { uri: string; ms: number; mine: boolean }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [loaded, setLoaded] = useState(false);
  const total = status.duration > 0 ? status.duration * 1000 : ms;
  const at = loaded ? status.currentTime * 1000 : 0;
  const ended = loaded && total > 0 && at >= total - 50;
  const frac = total > 0 && !ended ? Math.min(1, at / total) : 0;
  const playing = loaded && status.playing;

  const toggle = () => {
    haptics.light();
    // plays even with the iPhone's silent switch on – the person tapped play on purpose
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    if (!loaded) {
      player.replace({ uri });
      setLoaded(true);
      player.play();
      return;
    }
    if (playing) {
      player.pause();
      return;
    }
    if (ended) void player.seekTo(0);
    player.play();
  };

  const fg = mine ? colors.white : colors.ink;
  return (
    <View style={styles.voice}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? nb.chat.voicePause : nb.chat.voicePlay(formatClip(ms))}
        onPress={toggle}
        hitSlop={6}
        style={({ pressed }) => [styles.play, mine ? styles.playMine : styles.playTheirs, pressed && styles.pressed]}
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} color={mine ? colors.ink : colors.white} filled />
      </Pressable>
      <View style={styles.voiceBody}>
        <View style={[styles.track, mine ? styles.trackMine : styles.trackTheirs]}>
          <View style={[styles.fill, { width: `${Math.round(frac * 100)}%`, backgroundColor: mine ? colors.lime : colors.cyanDeep }]} />
        </View>
        <Text style={[text.time, styles.voiceTime, { color: fg }]}>{formatClip(playing || (at > 0 && !ended) ? at : total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  recCancel: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerTint },
  recMid: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recTime: { ...text.label, fontVariant: ['tabular-nums'], color: colors.ink },
  recHint: { ...text.meta, flex: 1 },
  recSend: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 210, paddingVertical: 2 },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  playMine: { backgroundColor: colors.lime },
  playTheirs: { backgroundColor: colors.ink },
  voiceBody: { flex: 1, minWidth: 0, gap: 6 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackMine: { backgroundColor: colors.onInk25 },
  trackTheirs: { backgroundColor: colors.track },
  fill: { height: 4, borderRadius: 2 },
  voiceTime: { fontVariant: ['tabular-nums'] },
});
