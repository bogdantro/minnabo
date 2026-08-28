import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ListingFilter, ListingSort } from '@/domain/types';

const KEY = 'minnabo.savedSearches';

export type SavedSearch = {
  id: string;
  name: string;
  filter: ListingFilter;
  sort: ListingSort;
  createdAt: string;
};

let searches: SavedSearch[] = [];
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};
const persist = () => {
  AsyncStorage.setItem(KEY, JSON.stringify(searches)).catch(() => undefined);
};

export const savedSearchStore = {
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      searches = raw ? (JSON.parse(raw) as SavedSearch[]) : [];
      emit();
    } catch {
      searches = [];
    }
  },
  list: () => searches,
  version: () => version,
  add: (name: string, filter: ListingFilter, sort: ListingSort) => {
    const item: SavedSearch = {
      id: `ss-${Date.now()}`,
      name: name.trim(),
      filter,
      sort,
      createdAt: new Date().toISOString(),
    };
    searches = [item, ...searches];
    persist();
    emit();
    return item;
  },
  remove: (id: string) => {
    searches = searches.filter((s) => s.id !== id);
    persist();
    emit();
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  _reset: () => {
    searches = [];
    emit();
  },
};

export function useSavedSearches(): SavedSearch[] {
  useSyncExternalStore(savedSearchStore.subscribe, savedSearchStore.version, savedSearchStore.version);
  return savedSearchStore.list();
}
