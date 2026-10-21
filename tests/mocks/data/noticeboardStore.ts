import type { NoticeboardPost, NoticeComment, NoticeKind } from '@/domain/types';
import { UserError } from '@/lib/errors';
import { profileRepository } from './profileRepository';

const SEED: NoticeboardPost[] = [
  {
    id: 'n-seed-1',
    kind: 'GIVEAWAY',
    title: 'Gis bort: barnesykkel 16"',
    body: 'Rød barnesykkel i god stand. Hentes på Stampesletta.',
    authorProfileId: 'u-emma',
    place: 'Lillehammer',
    municipality: 'Lillehammer',
    createdAt: '2026-08-30T09:00:00Z',
  },
  {
    id: 'n-seed-2',
    kind: 'TOOL_LEND',
    title: 'Låner ut: slagbormaskin og stige',
    body: 'Har en kraftig slagbormaskin og en 3 m stige som naboer gjerne kan låne.',
    authorProfileId: 'u-martin',
    place: 'Gjøvik',
    municipality: 'Gjøvik',
    createdAt: '2026-08-29T16:30:00Z',
  },
  {
    id: 'n-seed-3',
    kind: 'LOST_FOUND',
    title: 'Funnet: nøkkelknippe ved Søndre park',
    body: 'Fant et knippe med tre nøkler og en rød brikke. Ta kontakt for å beskrive.',
    authorProfileId: 'u-jonas',
    place: 'Lillehammer',
    municipality: 'Lillehammer',
    createdAt: '2026-08-28T18:00:00Z',
  },
];

let posts: NoticeboardPost[] = [...SEED];
let seq = 0;
let saved = new Set<string>();
let comments: NoticeComment[] = [];

export const noticeboardStore = {
  list(kind?: NoticeKind): NoticeboardPost[] {
    return [...posts]
      .map((p) => ({ ...p, replies: comments.filter((c) => c.noticeId === p.id).length }))
      .filter((p) => !kind || p.kind === kind)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },
  create(input: {
    kind: NoticeKind;
    title: string;
    body: string;
    place: string;
    municipality: string;
    /** storage path in `listing-images` */
    imagePath?: string;
    neighbourhoodId?: string;
  }): NoticeboardPost {
    const post: NoticeboardPost = {
      id: `n-${Date.now()}-${seq++}`,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body.trim(),
      place: input.place.trim(),
      municipality: input.municipality.trim(),
      authorProfileId: profileRepository.currentUserId,
      createdAt: new Date().toISOString(),
      imageUrl: input.imagePath,
      neighbourhoodId: input.neighbourhoodId,
    };
    posts = [post, ...posts];
    return post;
  },
  remove(id: string): void {
    posts = posts.filter((p) => p.id !== id);
  },
  get: (id: string): NoticeboardPost | undefined => posts.find((p) => p.id === id),
  update(id: string, patch: { kind?: NoticeKind; title?: string; body?: string; imagePath?: string | null; done?: boolean }): NoticeboardPost {
    const cur = posts.find((p) => p.id === id);
    if (!cur || cur.authorProfileId !== profileRepository.currentUserId) throw new UserError('Ikke tilgang.');
    const next: NoticeboardPost = {
      ...cur,
      kind: patch.kind ?? cur.kind,
      title: patch.title?.trim() ?? cur.title,
      body: patch.body?.trim() ?? cur.body,
      imageUrl: patch.imagePath === undefined ? cur.imageUrl : patch.imagePath ?? undefined,
      doneAt: patch.done === undefined ? cur.doneAt : patch.done ? new Date().toISOString() : undefined,
      editedAt: patch.title !== undefined || patch.body !== undefined ? new Date().toISOString() : cur.editedAt,
    };
    posts = posts.map((p) => (p.id === id ? next : p));
    return next;
  },
  comments: (noticeId: string): NoticeComment[] => comments.filter((c) => c.noticeId === noticeId),
  addComment(noticeId: string, body: string, authorProfileId = profileRepository.currentUserId): NoticeComment {
    const post = posts.find((p) => p.id === noticeId);
    if (!post) throw new UserError('Fant ikke oppslaget.');
    if (post.doneAt) throw new UserError('Oppslaget er avsluttet.');
    const c: NoticeComment = { id: `nc-${Date.now()}-${seq++}`, noticeId, authorProfileId, body: body.trim(), createdAt: new Date().toISOString() };
    comments = [...comments, c];
    return c;
  },
  removeComment(id: string): void {
    comments = comments.filter((c) => c.id !== id);
  },
  savedIds: (): string[] => [...saved],
  toggleSaved(id: string): string[] {
    const next = new Set(saved);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saved = next;
    return [...saved];
  },
  _reset(): void {
    posts = [...SEED];
    saved = new Set();
    comments = [];
  },
};
