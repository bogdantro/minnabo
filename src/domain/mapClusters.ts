import type { Listing } from './types';
import { kommuneCentre } from '@/data/kommuner';
import { mapTileUrl } from '@/config/mapStyle';

export type MapCluster<T = Listing> = {
  /** "kommune|place" */
  id: string;
  place: string;
  municipality: string;
  lat: number;
  lon: number;
  /** what is in the circle: oppdrag, or oppslag on the «Gis bort og funnet» map */
  listings: T[];
};

const PLACE_SPREAD = 0.05;
/** Golden angle: places in a kommune spread out evenly however many there are. */
const GOLDEN = (137.5 * Math.PI) / 180;

export const TILE = 256;
/** The map images: Kartverket, or a modern style when one is set up (src/config/mapStyle.ts). */
export const tileUrl = (z: number, x: number, y: number) => mapTileUrl(z, x, y);
export const MIN_ZOOM = 5;
/** Rule 6: never closer than a whole town. The circles are not real positions and must not look like it. */
export const MAX_ZOOM = 12;
/** Closest a first view goes, so one lonely circle still shows its surroundings. */
const FIT_MAX_ZOOM = 10;

/**
 * Posts grouped per place. A place sits on a fixed spot around its kommune's centre, spread out by
 * order and not by where it really is: rule 6, the map must never hint at an address.
 */
export function mapClusters(listings: Listing[]): MapCluster[] {
  return placeClusters(listings, (l) => l.location);
}

/** The same grouping for anything else that has a kommune and a place (an oppslag, 0101). */
export function placeClusters<T>(items: T[], where: (t: T) => { municipality: string; place?: string }): MapCluster<T>[] {
  const groups = new Map<string, T[]>();
  for (const l of items) {
    const w = where(l);
    const key = `${w.municipality}|${w.place || w.municipality}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  const seen = new Map<string, number>();
  return [...groups.keys()].sort().flatMap((id) => {
    const [municipality, place] = id.split('|');
    const centre = kommuneCentre(municipality);
    if (!centre) return [];
    const i = seen.get(municipality) ?? 0;
    seen.set(municipality, i + 1);
    const r = i === 0 ? 0 : PLACE_SPREAD * Math.sqrt(i);
    return [{
      id,
      place,
      municipality,
      lat: centre[0] + r * Math.cos(i * GOLDEN),
      lon: centre[1] + (r * Math.sin(i * GOLDEN)) / Math.cos((centre[0] * Math.PI) / 180),
      listings: groups.get(id)!,
    }];
  });
}

/** (lat, lon) -> pixels on the web-mercator world at this zoom. */
export function project(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const world = TILE * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * world,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world,
  };
}

/** The closest zoom that shows every circle, and the point in the middle of them (in world pixels). */
export function fitMap(clusters: MapCluster<unknown>[], width: number, height: number): { zoom: number; x: number; y: number } {
  const pad = 0.62;
  for (let zoom = FIT_MAX_ZOOM; zoom >= MIN_ZOOM; zoom--) {
    const pts = clusters.map((c) => project(c.lat, c.lon, zoom));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    if ((spanX <= width * pad && spanY <= height * pad) || zoom === MIN_ZOOM) {
      return { zoom, x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 };
    }
  }
  return { zoom: MIN_ZOOM, x: 0, y: 0 };
}

/** Circles that would land on top of each other at this zoom become one. The biggest gives the name. */
export function mergeNearby<T>(clusters: MapCluster<T>[], zoom: number, minPx: number): MapCluster<T>[] {
  const out: (MapCluster<T> & { px: { x: number; y: number } })[] = [];
  for (const c of [...clusters].sort((a, b) => b.listings.length - a.listings.length)) {
    const px = project(c.lat, c.lon, zoom);
    const near = out.find((o) => Math.hypot(o.px.x - px.x, o.px.y - px.y) < minPx);
    if (near) near.listings = [...near.listings, ...c.listings];
    else out.push({ ...c, px });
  }
  return out.map(({ px: _px, ...c }) => c);
}
