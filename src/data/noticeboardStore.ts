import type { NoticeboardPost, NoticeKind } from '@/domain/types';
import { profileRepository } from './profileRepository';

const SEED: NoticeboardPost[] = [
  {
    id: 'n-seed-1',
    kind: 'GIVEAWAY',
    title: 'Gis bort: barnesykkel 16"',
    body: 'Rød barnesykkel i god stand. Hentes på Stampesletta.',
    authorProfileId: 'u-emma',
    place: 'Lillehammer',
    createdAt: '2026-08-30T09:00:00Z',
  },
  {
    id: 'n-seed-2',
    kind: 'TOOL_LEND',
    title: 'Låner ut: slagbormaskin og stige',
    body: 'Har en kraftig slagbormaskin og en 3 m stige som naboer gjerne kan låne.',
    authorProfileId: 'u-martin',
    place: 'Gjøvik',
    createdAt: '2026-08-29T16:30:00Z',
  },
  {
    id: 'n-seed-3',
    kind: 'LOST_FOUND',
    title: 'Funnet: nøkkelknippe ved Søndre park',
    body: 'Fant et knippe med tre nøkler og en rød brikke. Ta kontakt for å beskrive.',
    authorProfileId: 'u-jonas',
    place: 'Lillehammer',
    createdAt: '2026-08-28T18:00:00Z',
  },
];

let posts: NoticeboardPost[] = [...SEED];
let seq = 0;

export const noticeboardStore = {
  list(kind?: NoticeKind): NoticeboardPost[] {
    return [...posts]
      .filter((p) => !kind || p.kind === kind)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },
  create(input: { kind: NoticeKind; title: string; body: string; place: string }): NoticeboardPost {
    const post: NoticeboardPost = {
      id: `n-${Date.now()}-${seq++}`,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body.trim(),
      place: input.place.trim(),
      authorProfileId: profileRepository.currentUserId,
      createdAt: new Date().toISOString(),
    };
    posts = [post, ...posts];
    return post;
  },
  remove(id: string): void {
    posts = posts.filter((p) => p.id !== id);
  },
  _reset(): void {
    posts = [...SEED];
  },
};
