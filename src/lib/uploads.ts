import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { publicUrl } from './storage';
import { UserError, backendError } from './errors';

/** `report-attachments` is private (reporter + admins only); the others are public-read. */
export type UploadBucket = 'avatars' | 'listing-images' | 'chat-attachments' | 'report-attachments';

const MAX_BYTES = 8 * 1024 * 1024;
const OK_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

type Asset = { mimeType?: string | null; fileSize?: number | null; uri?: string };

/** Returns a Norwegian error string, or null when the asset is acceptable. */
export function validateImage(asset: Asset): string | null {
  const mime = (asset.mimeType ?? '').toLowerCase();
  if (mime && !OK_MIME.includes(mime)) {
    return 'Filen må være et bilde (JPG, PNG eller WEBP).';
  }
  if (asset.fileSize && asset.fileSize > MAX_BYTES) {
    return 'Bildet er for stort. Maks 8 MB.';
  }
  return null;
}

const rand = () => Math.random().toString(36).slice(2, 10);

async function compress(uri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return out.uri;
}

async function uploadUri(
  bucket: UploadBucket,
  folder: string,
  uri: string,
): Promise<PickResult> {
  const compressed = await compress(uri);
  const res = await fetch(compressed);
  const bytes = await res.arrayBuffer();
  const path = `${folder}/${Date.now()}-${rand()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw backendError(error);
  return {
    path,
    // private buckets have no public link (chat photos are shown through signed links)
    publicUrl: bucket === 'report-attachments' || bucket === 'chat-attachments' ? '' : publicUrl(bucket, path)!,
    localUri: compressed,
    bytes: bytes.byteLength,
  };
}

/** `publicUrl` is empty for the private buckets; `localUri` / `bytes` describe the uploaded file. */
export type PickResult = { path: string; publicUrl: string; localUri?: string; bytes?: number };

/**
 * Ask for permission, open the camera or library, validate + compress, and
 * upload to Storage under `{folder}/…`. Returns null if the user cancels.
 * Throws with a Norwegian message on a real failure.
 */
export async function pickAndUpload(opts: {
  bucket: UploadBucket;
  folder: string;
  source: 'camera' | 'library';
}): Promise<PickResult | null> {
  const { bucket, folder, source } = opts;

  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new UserError('MinNabo trenger tilgang til kameraet.');
    const r = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (r.canceled) return null;
    const asset = r.assets[0];
    const err = validateImage(asset);
    if (err) throw new UserError(err);
    return uploadUri(bucket, folder, asset.uri);
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new UserError('MinNabo trenger tilgang til bildene dine.');
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
  });
  if (r.canceled) return null;
  const asset = r.assets[0];
  const err = validateImage(asset);
  if (err) throw new UserError(err);
  return uploadUri(bucket, folder, asset.uri);
}

/**
 * Pick several images at once from the library (up to `max`), validate, and
 * upload them in parallel. `onStart(n)` reports how many are uploading so the
 * UI can show placeholders. Invalid files are skipped with an error if none are left.
 */
export async function pickAndUploadMany(opts: {
  bucket: UploadBucket;
  folder: string;
  max: number;
  onStart?: (n: number) => void;
}): Promise<PickResult[]> {
  const { bucket, folder, max, onStart } = opts;
  if (max <= 0) return [];
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new UserError('MinNabo trenger tilgang til bildene dine.');
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    orderedSelection: true,
  });
  if (r.canceled) return [];
  const assets = r.assets.slice(0, max);
  const ok = assets.filter((a) => validateImage(a) == null);
  if (!ok.length) throw new UserError(validateImage(assets[0]) ?? 'Kunne ikke bruke bildene.');
  onStart?.(ok.length);
  return Promise.all(ok.map((a) => uploadUri(bucket, folder, a.uri)));
}
