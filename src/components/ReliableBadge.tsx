import type { StyleProp, ViewStyle } from 'react-native';
import { useReliability } from '@/api/queries';
import { alwaysShowsUp } from '@/domain/reliability';
import { ReliableLine } from './ui';

/** True when this helper has turned up for every one of 5+ jobs. `undefined` asks nothing. */
export function useAlwaysShowsUp(profileId: string | undefined): boolean {
  return alwaysShowsUp(useReliability(profileId).data);
}

/** «Møter alltid opp» for one helper; renders nothing until they have earned it. */
export function ReliableBadge({ profileId, style }: { profileId: string; style?: StyleProp<ViewStyle> }) {
  if (!useAlwaysShowsUp(profileId)) return null;
  return <ReliableLine style={style} />;
}
