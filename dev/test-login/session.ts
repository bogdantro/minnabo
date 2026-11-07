/** Stands in for src/auth/session.ts under `npm run test-login`. */
import { useEffect, useState } from 'react';
import { queryClientRef } from '../../src/auth/queryClientRef';
import { TEST_USER_ID, testPerson } from './store';

export type SessionStatus = 'loading' | 'authed' | 'anon';
export type SessionState = { session: null; userId: string | null; status: SessionStatus };

export function useSession(): SessionState {
  const [person, setPerson] = useState(testPerson.get());
  useEffect(() => testPerson.subscribe(() => setPerson(testPerson.get())), []);
  return { session: null, userId: person ? TEST_USER_ID : null, status: person ? 'authed' : 'anon' };
}

export async function signOut(): Promise<void> {
  testPerson.set(null);
  queryClientRef.current?.clear();
}
