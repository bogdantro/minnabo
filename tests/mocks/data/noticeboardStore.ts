import type { EventType, NoticeboardPost, NoticeComment, NoticeKind } from '@/domain/types';
import type { NoticeTopic } from '@/domain/community';
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
const liked = new Set<string>();
let comments: NoticeComment[] = [];

export const noticeboardStore = {
  list(kind?: NoticeKind): NoticeboardPost[] {
    return [...posts]
      .map((p) => ({ ...p, replies: comments.filter((c) => c.noticeId === p.id).length, likes: (p.likes ?? 0) + (liked.has(p.id) ? 1 : 0), likedByMe: liked.has(p.id) }))
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
    imagePaths?: string[];
    neighbourhoodId?: string;
    isDugnad?: boolean;
    eventAt?: string;
    /** an arrangement (0101); DUGNAD also sets isDugnad */
    eventType?: EventType;
    /** «Avstemning»: 2–6 choices (0101) */
    pollOptions?: string[];
    topic?: NoticeTopic;
    organisationId?: string;
    repeatWeekly?: boolean;
  }): NoticeboardPost {
    if (input.topic === 'RIDE' && profileRepository.getProfile(profileRepository.currentUserId)?.youthAge) {
      throw new UserError('Samkjøring er ikke tilgjengelig for ungdomskontoer.');
    }
    const lifetime = input.topic === 'FOOD' ? 24 : input.topic === 'OUTAGE' ? 6 : 0;
    const post: NoticeboardPost = {
      id: `n-${Date.now()}-${seq++}`,
      kind: input.topic ? 'GENERAL' : input.kind,
      topic: input.topic,
      expiresAt: lifetime ? new Date(Date.now() + lifetime * 3600 * 1000).toISOString() : undefined,
      organisationId: input.organisationId,
      repeatWeekly: input.repeatWeekly || undefined,
      title: input.title.trim(),
      body: input.body.trim(),
      place: input.place.trim(),
      municipality: input.municipality.trim(),
      authorProfileId: profileRepository.currentUserId,
      createdAt: new Date().toISOString(),
      imageUrl: input.imagePaths?.[0] ?? input.imagePath,
      imageUrls: input.imagePaths ?? (input.imagePath ? [input.imagePath] : undefined),
      neighbourhoodId: input.neighbourhoodId,
      isDugnad: input.isDugnad,
      eventAt: input.eventAt,
      eventType: input.eventType ?? (input.isDugnad ? 'DUGNAD' : undefined),
      pollOptions: input.pollOptions && input.pollOptions.length >= 2 ? input.pollOptions : undefined,
    };
    posts = [post, ...posts];
    return post;
  },
  setLiked(id: string, on: boolean): void {
    if (on) liked.add(id);
    else liked.delete(id);
  },
  remove(id: string): void {
    posts = posts.filter((p) => p.id !== id);
  },
  get: (id: string): NoticeboardPost | undefined => posts.find((p) => p.id === id),
  update(id: string, patch: { kind?: NoticeKind; title?: string; body?: string; imagePath?: string | null; imagePaths?: string[]; done?: boolean }): NoticeboardPost {
    const cur = posts.find((p) => p.id === id);
    if (!cur || cur.authorProfileId !== profileRepository.currentUserId) throw new UserError('Ikke tilgang.');
    const next: NoticeboardPost = {
      ...cur,
      kind: patch.kind ?? cur.kind,
      title: patch.title?.trim() ?? cur.title,
      body: patch.body?.trim() ?? cur.body,
      imageUrl: patch.imagePaths !== undefined ? patch.imagePaths[0] : patch.imagePath === undefined ? cur.imageUrl : patch.imagePath ?? undefined,
      imageUrls: patch.imagePaths !== undefined ? patch.imagePaths : patch.imagePath === undefined ? cur.imageUrls : patch.imagePath ? [patch.imagePath] : [],
      doneAt: patch.done === undefined ? cur.doneAt : patch.done ? new Date().toISOString() : undefined,
      editedAt: patch.title !== undefined || patch.body !== undefined ? new Date().toISOString() : cur.editedAt,
    };
    posts = posts.map((p) => (p.id === id ? next : p));
    return next;
  },
  comments: (noticeId: string): NoticeComment[] => comments.filter((c) => c.noticeId === noticeId),
  keep(id: string): void {
    posts = posts.map((p) => (p.id === id ? { ...p, stillAskedAt: undefined, autoClosed: undefined, doneAt: undefined } : p));
  },
  addComment(noticeId: string, body: string, authorProfileId = profileRepository.currentUserId, parentId?: string): NoticeComment {
    const post = posts.find((p) => p.id === noticeId);
    if (!post) throw new UserError('Fant ikke oppslaget.');
    if (post.doneAt) throw new UserError('Oppslaget er avsluttet.');
    // one level deep, like the database (0099)
    const parent = parentId ? comments.find((x) => x.id === parentId) : undefined;
    const c: NoticeComment = { id: `nc-${Date.now()}-${seq++}`, noticeId, parentId: parent ? (parent.parentId ?? parent.id) : undefined, authorProfileId, body: body.trim(), createdAt: new Date().toISOString() };
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
  /** An oppslag written by the database itself (the «Lån ut» oppslag of an Utlån thing, 0107). */
  _insert(post: NoticeboardPost): void {
    posts = [post, ...posts];
  },
  /** Tests: put an oppslag in a state the app reaches on its own over weeks (0099 tidy-up, several photos). */
  _patch(id: string, patch: Partial<NoticeboardPost>): void {
    posts = posts.map((p) => (p.id === id ? { ...p, ...patch } : p));
  },
  _reset(): void {
    posts = [...SEED];
    saved = new Set();
    comments = [];
  },
};
