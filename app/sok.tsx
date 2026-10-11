import { useLocalSearchParams } from 'expo-router';
import type { ListingSort } from '@/domain/types';
import { SearchScreen } from '@/screens/SearchScreen';

const SORTS: ListingSort[] = ['RELEVANCE', 'DISTANCE', 'NEWEST', 'PRICE'];
const list = (v: unknown) => (typeof v === 'string' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

/**
 * /sok?q=…&category=… – and from "Kjør søk" on a saved search also
 * &cats=a,b&verified=1&km=10&sort=NEWEST&kommuner=Lillehammer,Øyer
 */
export default function SearchRoute() {
  const p = useLocalSearchParams<{ q?: string; category?: string; cats?: string; verified?: string; km?: string; sort?: string; kommuner?: string }>();
  const km = Number(p.km);
  return (
    <SearchScreen
      initialQuery={typeof p.q === 'string' ? p.q : ''}
      initialCategory={typeof p.category === 'string' ? p.category : undefined}
      start={{
        categories: list(p.cats),
        verified: p.verified === '1',
        km: Number.isFinite(km) && km > 0 ? km : undefined,
        sort: SORTS.includes(p.sort as ListingSort) ? (p.sort as ListingSort) : undefined,
        kommuner: list(p.kommuner),
      }}
    />
  );
}
