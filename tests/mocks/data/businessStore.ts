import type { AdminBusiness, BusinessProfile } from '@/api/ApiClient';

/** business_profiles (mock): submissions wait as PENDING until an admin decides. */
type Row = AdminBusiness;

/** Demo queue for the admin panel (other users' registrations). */
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
  list: (): AdminBusiness[] => Object.values(rows).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  submit(
    profileId: string,
    input: Omit<BusinessProfile, 'profileId' | 'status' | 'createdAt'>,
  ): BusinessProfile {
    const row: Row = { ...input, profileId, status: 'PENDING', createdAt: new Date().toISOString(), decidedAt: null };
    rows = { ...rows, [profileId]: row };
    return row;
  },
  decide(profileId: string, approve: boolean): BusinessProfile | null {
    const r = rows[profileId];
    if (!r) return null;
    rows = { ...rows, [profileId]: { ...r, status: approve ? 'APPROVED' : 'REJECTED', decidedAt: new Date().toISOString() } };
    return rows[profileId];
  },
  _reset(): void {
    rows = { ...SEED };
  },
};
