// "Min faste hjelper" — profile ids the current user follows. In-memory for
// the mock layer; the real backend gets a follows table (migration 0012).

const SEED = ['u-emma'];

let followed = new Set<string>(SEED);

export const followStore = {
  list: () => [...followed],
  isFollowing: (profileId: string) => followed.has(profileId),
  toggle(profileId: string): string[] {
    const next = new Set(followed);
    if (next.has(profileId)) next.delete(profileId);
    else next.add(profileId);
    followed = next;
    return [...followed];
  },
  _reset() {
    followed = new Set(SEED);
  },
};
