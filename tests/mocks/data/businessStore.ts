import type { BusinessProfile } from '@/api/ApiClient';

/** business_profiles (mock): submissions wait as PENDING until the website's admin decides. */
type Row = BusinessProfile & { decidedAt: string | null };

/** Other users' registrations waiting for a decision. */
const SEED: Record<string, Row> = {
  'u-jonas': {
    profileId: 'u-jonas', orgNr: '923609016', companyName: 'Berg Maling og Hage AS', contactPerson: 'Jonas Berg',
    email: 'post@bergmaling.no', phone: '91234567', categorySlugs: ['maling', 'hage'], status: 'PENDING',
    createdAt: '2026-10-04T12:32:00Z', decidedAt: null,
  },
  'u-andreas': {
    profileId: 'u-andreas', orgNr: '987654325', companyName: 'Øyer Flyttehjelp', contactPerson: 'Andreas Moe',
    email: 'sara@oyerflytt.no', phone: '98765432', categorySlugs: ['flytting'], status: 'PENDING',
    createdAt: '2026-10-03T08:10:00Z', decidedAt: null,
  },
};

let rows: Record<string, Row> = { ...SEED };

export const businessStore = {
  get: (profileId: string): BusinessProfile | null => {
    const r = rows[profileId];
    if (!r) return null;
    const { decidedAt: _d, ...rest } = r;
    return rest;
  },
  list: (): Row[] => Object.values(rows).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  submit(
    profileId: string,
    input: Omit<BusinessProfile, 'profileId' | 'status' | 'createdAt'>,
  ): BusinessProfile {
    const row: Row = { ...input, profileId, status: 'PENDING', createdAt: new Date().toISOString(), decidedAt: null };
    rows = { ...rows, [profileId]: row };
    return row;
  },
  /** what the website's admin decided (with the reason when it is a no) */
  decide(profileId: string, approve: boolean, reason?: string): BusinessProfile | null {
    const r = rows[profileId];
    if (!r) return null;
    rows = {
      ...rows,
      [profileId]: { ...r, status: approve ? 'APPROVED' : 'REJECTED', rejectionReason: approve ? undefined : reason, decidedAt: new Date().toISOString() },
    };
    return rows[profileId];
  },
  _reset(): void {
    rows = { ...SEED };
  },
};
