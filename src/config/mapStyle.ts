/**
 * Which map the app draws under its circles (Søk › Vis på kart, «Område» on an oppdrag, the Legg ut wizard).
 *
 *   EXPO_PUBLIC_MAP_PROVIDER = stadia | maptiler   (anything else, or nothing: Kartverket)
 *   EXPO_PUBLIC_MAP_KEY      = the provider's API key
 *
 * Stadia «Alidade Smooth» and MapTiler «Streets» look like Apple and Google Maps. Both are paid for an app with
 * income (their free plans are for non-commercial use only), so they stay off until a key is set; until then the
 * free Kartverket map is shown and nothing breaks. On the web, Stadia also works without a key on localhost,
 * which is how the test login shows it.
 *
 * The provider sees the phone's IP address when it loads map images: Personvern must name it when it is on.
 */
export type MapProvider = 'kartverket' | 'stadia' | 'maptiler';

const KEY = process.env.EXPO_PUBLIC_MAP_KEY ?? '';
const WANTED = process.env.EXPO_PUBLIC_MAP_PROVIDER;

function pick(): MapProvider {
  if (WANTED === 'stadia') return 'stadia';
  if (WANTED === 'maptiler' && KEY) return 'maptiler';
  return 'kartverket';
}

export const MAP_PROVIDER: MapProvider = pick();

/** One map image, 256 points square. The modern styles send @2x images, so the map stays sharp on phones. */
export function mapTileUrl(z: number, x: number, y: number, provider: MapProvider = MAP_PROVIDER): string {
  switch (provider) {
    case 'stadia':
      return `https://tiles.stadiamaps.com/tiles/alidade_smooth/${z}/${x}/${y}@2x.png${KEY ? `?api_key=${KEY}` : ''}`;
    case 'maptiler':
      return `https://api.maptiler.com/maps/streets-v2/256/${z}/${x}/${y}@2x.png?key=${KEY}`;
    default:
      return `https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/${z}/${y}/${x}.png`;
  }
}

/** The credit each provider requires on the map. */
export const MAP_CREDIT: Record<MapProvider, string> = {
  kartverket: '© Kartverket',
  stadia: '© Stadia Maps © OpenMapTiles © OpenStreetMap',
  maptiler: '© MapTiler © OpenStreetMap',
};
