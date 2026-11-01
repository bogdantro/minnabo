import type { ReliabilityDetails } from './types';

/** «Møter alltid opp» needs this many finished jobs, so one lucky job doesn't earn it. */
export const RELIABLE_MIN_JOBS = 5;

/** 100 % «møter opp» over at least 5 jobs → true. Any counted no-show (0074) takes it away. */
export function alwaysShowsUp(r: ReliabilityDetails | undefined): boolean {
  return !!r && r.completed >= RELIABLE_MIN_JOBS && r.showsUp === 100;
}
