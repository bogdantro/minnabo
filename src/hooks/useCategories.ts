import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { categoryKeys } from '@/api/queries';
import { getCategoryCatalog, setCategoryCatalog, subscribeCategoryCatalog, type CatalogEntry } from '@/domain/categories';
import type { CategoryId } from '@/theme/theme';

/** The live category catalogue; a component that calls this re-renders when the website changes it. */
export function useCategoryCatalog(): CatalogEntry[] {
  return useSyncExternalStore(subscribeCategoryCatalog, getCategoryCatalog, getCategoryCatalog);
}

/** Categories that are switched on, in the admin's order – for chips, the Legg ut grid and filters. */
export function useActiveCategories(): CategoryId[] {
  const catalog = useCategoryCatalog();
  return useMemo(() => catalog.filter((e) => e.active).map((e) => e.art), [catalog]);
}

/**
 * Loads public.categories into the catalogue and keeps it fresh (PlatformRealtime refetches
 * on every change). Renders nothing. Until it has loaded – or offline – the built-in list is used.
 */
export function CategorySync(): null {
  const { data } = useQuery({ queryKey: categoryKeys.all, queryFn: () => apiClient.listCategories(), staleTime: 5 * 60_000 });
  useEffect(() => {
    setCategoryCatalog(data);
  }, [data]);
  return null;
}
