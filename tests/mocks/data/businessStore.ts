import type { BusinessProfile } from '@/api/ApiClient';

/** business_profiles (mock): submissions wait as PENDING until an admin decides. */
let rows: Record<string, BusinessProfile> = {};

export const businessStore = {
  get: (profileId: string): BusinessProfile | null => rows[profileId] ?? null,
  list: (): BusinessProfile[] => Object.values(rows),
  submit(
    profileId: string,
    input: Omit<BusinessProfile, 'profileId' | 'status' | 'createdAt'>,
  ): BusinessProfile {
    const row: BusinessProfile = { ...input, profileId, status: 'PENDING', createdAt: new Date().toISOString() };
    rows = { ...rows, [profileId]: row };
    return row;
  },
  decide(profileId: string, approve: boolean): BusinessProfile | null {
    const r = rows[profileId];
    if (!r) return null;
    rows = { ...rows, [profileId]: { ...r, status: approve ? 'APPROVED' : 'REJECTED' } };
    return rows[profileId];
  },
  _reset(): void {
    rows = {};
  },
};
