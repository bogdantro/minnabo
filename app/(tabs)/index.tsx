import { OppdragScreen } from '@/screens/OppdragScreen';
import { SeniorHomeScreen } from '@/screens/SeniorHomeScreen';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSeniorMode } from '@/lib/seniorMode';

/** Oppdrag is home (rule 9); with «Enkel visning» on (0101) an adult gets the simple start instead. */
export default function Home() {
  const [senior] = useSeniorMode();
  const me = useCurrentUser();
  return senior && !me.isYouth ? <SeniorHomeScreen /> : <OppdragScreen />;
}
