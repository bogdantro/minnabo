import { supabase } from '@/lib/supabase';
import type { OppdragApi } from './oppdragApi';
import { SupabaseInbox } from './supabaseInbox';

/** The Oppdrag part of the Supabase client (0110). Before 0110 is pushed every call answers «nothing». */
export class SupabaseOppdrag extends SupabaseInbox implements OppdragApi {
  async listingOfferCounts(listingIds: string[]): Promise<Record<string, number>> {
    if (!listingIds.length) return {};
    const { data, error } = await supabase.rpc('listing_offer_counts', { p_ids: listingIds.slice(0, 100) });
    if (error || !data) return {};
    return data as Record<string, number>;
  }

  async fastResponders(profileIds: string[]): Promise<string[]> {
    if (!profileIds.length) return [];
    const { data, error } = await supabase.rpc('fast_responders', { p_ids: [...new Set(profileIds)].slice(0, 60) });
    if (error) return [];
    return (data ?? []) as string[];
  }

  async logSearchTerm(municipality: string, term: string): Promise<void> {
    await supabase.rpc('log_search_term', { p_municipality: municipality, p_term: term });
  }

  async popularSearchTerms(municipality: string): Promise<string[]> {
    const { data, error } = await supabase.rpc('popular_search_terms', { p_municipality: municipality });
    if (error) return [];
    return (data ?? []) as string[];
  }
}
