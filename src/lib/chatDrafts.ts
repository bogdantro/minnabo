/**
 * Unsent text per conversation (Innboks, 0109): the chat field keeps what you wrote when you leave, and Innboks
 * shows «Utkast: …» on the row. Kept on this phone only.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'minnabo.chatDrafts.v1';
// a draft longer than this is cut, so the stored list never grows large
const MAX_LEN = 2000;

let drafts: Record<string, string> = {};
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loaded) return;
  loaded = true;
  void AsyncStorage.getItem(KEY)
    .then((raw) => {
      const parsed = raw ? (JSON.parse(raw) as unknown) : {};
      // what was typed before the stored drafts arrived wins over the stored copy
      drafts = { ...(parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}), ...drafts };
    })
    .catch(() => undefined)
    .finally(emit);
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  // typing writes many times a second; store once it settles
  saveTimer = setTimeout(() => void AsyncStorage.setItem(KEY, JSON.stringify(drafts)).catch(() => undefined), 400);
}

export const chatDrafts = {
  get: (conversationId: string): string => {
    load();
    return drafts[conversationId] ?? '';
  },
  /** Tests only. */
  _reset() {
    drafts = {};
    emit();
  },
  set(conversationId: string, text: string) {
    load();
    const t = text.slice(0, MAX_LEN);
    if ((drafts[conversationId] ?? '') === t) return;
    if (t.trim()) drafts = { ...drafts, [conversationId]: t };
    else {
      const next = { ...drafts };
      delete next[conversationId];
      drafts = next;
    }
    persist();
    emit();
  },
};

/** Every draft, for Innboks; re-renders when one changes. */
export function useChatDrafts(): Record<string, string> {
  load();
  const [all, setAll] = useState(drafts);
  useEffect(() => {
    const on = () => setAll(drafts);
    listeners.add(on);
    on();
    return () => {
      listeners.delete(on);
    };
  }, []);
  return all;
}
