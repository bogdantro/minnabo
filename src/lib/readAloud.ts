/**
 * «Les opp» on a chat message (0109): the phone's own voice in Norwegian (expo-speech). Nothing leaves the phone.
 * Without the module (an older build) it simply does nothing.
 */
let speaking = false;

export async function readAloud(text: string): Promise<boolean> {
  try {
    const Speech = await import('expo-speech');
    if (speaking) {
      await Speech.stop();
      speaking = false;
      return false;
    }
    speaking = true;
    Speech.speak(text, {
      language: 'nb-NO',
      rate: 0.95,
      onDone: () => {
        speaking = false;
      },
      onStopped: () => {
        speaking = false;
      },
      onError: () => {
        speaking = false;
      },
    });
    return true;
  } catch {
    speaking = false;
    return false;
  }
}

export const isReadingAloud = () => speaking;
