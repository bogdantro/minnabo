/** The map provider is chosen from EXPO_PUBLIC_MAP_PROVIDER / EXPO_PUBLIC_MAP_KEY when the app is built. */
const load = (env: Record<string, string | undefined>) => {
  const before = { ...process.env };
  Object.assign(process.env, env);
  let mod: typeof import('@/config/mapStyle') | undefined;
  jest.isolateModules(() => {
    mod = require('@/config/mapStyle');
  });
  process.env = before;
  return mod!;
};

test('without a setting the free Kartverket map is used', () => {
  const m = load({ EXPO_PUBLIC_MAP_PROVIDER: '', EXPO_PUBLIC_MAP_KEY: '' });
  expect(m.MAP_PROVIDER).toBe('kartverket');
  expect(m.mapTileUrl(10, 545, 280)).toBe('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/10/280/545.png');
});

test('Stadia gives sharp @2x images with the key', () => {
  const m = load({ EXPO_PUBLIC_MAP_PROVIDER: 'stadia', EXPO_PUBLIC_MAP_KEY: 'abc' });
  expect(m.MAP_PROVIDER).toBe('stadia');
  expect(m.mapTileUrl(10, 545, 280)).toBe('https://tiles.stadiamaps.com/tiles/alidade_smooth/10/545/280@2x.png?api_key=abc');
  expect(m.MAP_CREDIT.stadia).toContain('OpenStreetMap');
});

test('MapTiler without a key falls back to Kartverket instead of showing a broken map', () => {
  expect(load({ EXPO_PUBLIC_MAP_PROVIDER: 'maptiler', EXPO_PUBLIC_MAP_KEY: '' }).MAP_PROVIDER).toBe('kartverket');
  const m = load({ EXPO_PUBLIC_MAP_PROVIDER: 'maptiler', EXPO_PUBLIC_MAP_KEY: 'k1' });
  expect(m.mapTileUrl(9, 1, 2)).toBe('https://api.maptiler.com/maps/streets-v2/256/9/1/2@2x.png?key=k1');
});
