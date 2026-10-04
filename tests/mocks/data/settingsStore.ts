import { DEFAULT_NOTIFICATION_PREFS, type MySettings, type NotificationPrefs } from '@/api/ApiClient';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const seed = (): MySettings => ({ email: 'marius.b@epost.no', notificationPrefs: clone(DEFAULT_NOTIFICATION_PREFS) });

let settings = seed();
let tokens: string[] = [];

export const settingsStore = {
  get: (): MySettings => clone(settings),
  setPrefs(prefs: NotificationPrefs): MySettings {
    settings = { ...settings, notificationPrefs: clone(prefs) };
    return clone(settings);
  },
  addToken(token: string): void {
    if (!tokens.includes(token)) tokens = [...tokens, token];
  },
  tokens: () => [...tokens],
  _reset(): void {
    settings = seed();
    tokens = [];
  },
};
