import { validateImage } from '@/lib/uploads';

test('validateImage rejects a non-image mime type', () => {
  expect(validateImage({ mimeType: 'application/pdf', fileSize: 100 })).toMatch(/bilde/i);
});

test('validateImage rejects a file larger than 8 MB', () => {
  expect(validateImage({ mimeType: 'image/jpeg', fileSize: 9_000_000 })).toMatch(/for stor/i);
});

test('validateImage accepts a normal jpeg', () => {
  expect(validateImage({ mimeType: 'image/jpeg', fileSize: 400_000 })).toBeNull();
});

test('validateImage accepts an asset with no metadata', () => {
  expect(validateImage({})).toBeNull();
});
