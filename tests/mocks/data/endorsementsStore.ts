import type { SkillEndorsement } from '@/domain/types';
import { profileRepository } from './profileRepository';

// endorsements[targetProfileId][skill] = Set of endorser profile ids
type Store = Record<string, Record<string, Set<string>>>;

const SEED: { target: string; skill: string; by: string[] }[] = [
  { target: 'u-emma', skill: 'Hagearbeid', by: ['u-jonas', 'u-martin', 'u-sara'] },
  { target: 'u-emma', skill: 'Punktlig', by: ['u-jonas'] },
  { target: 'u-andreas', skill: 'Snekring', by: ['u-mb', 'u-sara'] },
];

function seed(): Store {
  const s: Store = {};
  for (const { target, skill, by } of SEED) {
    s[target] ??= {};
    s[target][skill] = new Set(by);
  }
  return s;
}

let store: Store = seed();

const me = () => profileRepository.currentUserId;

export const endorsementsStore = {
  list(targetProfileId: string): SkillEndorsement[] {
    const skills = store[targetProfileId] ?? {};
    return Object.entries(skills)
      .map(([skill, people]) => ({
        skill,
        count: people.size,
        byMe: people.has(me()),
      }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);
  },

  toggle(targetProfileId: string, skill: string): SkillEndorsement[] {
    if (targetProfileId === me()) return endorsementsStore.list(targetProfileId);
    store = { ...store, [targetProfileId]: { ...(store[targetProfileId] ?? {}) } };
    const people = new Set(store[targetProfileId][skill] ?? []);
    if (people.has(me())) people.delete(me());
    else people.add(me());
    store[targetProfileId][skill] = people;
    return endorsementsStore.list(targetProfileId);
  },

  _reset() {
    store = seed();
  },
};
