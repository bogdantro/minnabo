import { useLocalSearchParams } from 'expo-router';
import type { ListingSort } from '@/domain/types';
import { WHEN_FILTERS, type KindFilter, type WhenFilter } from '@/domain/listingFilters';
import { SearchScreen } from '@/screens/SearchScreen';

const SORTS: ListingSort[] = ['RELEVANCE', 'DISTANCE', 'NEWEST', 'PRICE'];
const KINDS: KindFilter[] = ['ALL', 'TASK_REQUEST', 'SERVICE_OFFER'];
const list = (v: unknown) => (typeof v === 'string' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

/**
 * /sok?q=…&category=… – and from "Kjør søk" on a saved search also
 * &cats=a,b&km=10&sort=NEWEST&kommuner=Lillehammer,Øyer&kind=SERVICE_OFFER&when=WEEKEND&min=500&urgent=1
 */
export default function SearchRoute() {
  const p = useLocalSearchParams<{ q?: string; category?: string; cats?: string; km?: string; sort?: string; kommuner?: string; kind?: string; when?: string; min?: string; urgent?: string }>();
  const km = Number(p.km);
  const min = Number(p.min);
  return (
    <SearchScreen
      initialQuery={typeof p.q === 'string' ? p.q : ''}
      initialCategory={typeof p.category === 'string' ? p.category : undefined}
      start={{
        categories: list(p.cats),
        km: Number.isFinite(km) && km > 0 ? km : undefined,
        sort: SORTS.includes(p.sort as ListingSort) ? (p.sort as ListingSort) : undefined,
        kommuner: list(p.kommuner),
        kind: KINDS.includes(p.kind as KindFilter) ? (p.kind as KindFilter) : undefined,
        when: WHEN_FILTERS.includes(p.when as WhenFilter) ? (p.when as WhenFilter) : undefined,
        minKr: Number.isFinite(min) && min > 0 ? min : undefined,
        urgent: p.urgent === '1',
      }}
    />
  );
}
