import { render, screen } from '@testing-library/react-native';
import { Image } from '@/components/ui/Image';

// expo-image is mocked to React Native's Image (jest-setup.ts), so the props it got can be read back
const propsOf = () => screen.getByTestId('img').props;

test('a photo from storage is cached on disk, fades in, and has a flat placeholder colour while loading', async () => {
  await render(<Image testID="img" source={{ uri: 'https://x.supabase.co/a.jpg' }} style={{ width: 10, height: 10 }} />);
  const p = propsOf();
  expect(p.cachePolicy).toBe('memory-disk');
  expect(p.transition).toBeGreaterThan(0);
  expect(p.contentFit).toBe('cover');
  expect(JSON.stringify(p.style)).toContain('backgroundColor');
});

test('a bundled logo shows as it is: no fade, no placeholder', async () => {
  await render(<Image testID="img" source={1 as never} resizeMode="contain" />);
  const p = propsOf();
  expect(p.transition).toBe(0);
  expect(p.contentFit).toBe('contain');
  expect(JSON.stringify(p.style)).not.toContain('backgroundColor');
});
