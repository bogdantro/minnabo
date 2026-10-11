import { ENV } from './env';

type Bucket = 'avatars' | 'listing-images';

/**
 * Resolves a Storage object path to a public URL.
 * - `null` / empty → `undefined`
 * - already an absolute URL (seeded stock images) → returned unchanged
 * - a bucket-relative path → the public object URL
 */
export function publicUrl(bucket: Bucket, path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.replace(/^\/+/, '');
  return `${ENV.supabaseUrl}/storage/v1/object/public/${bucket}/${clean}`;
}
