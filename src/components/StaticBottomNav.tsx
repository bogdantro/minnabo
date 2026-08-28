import { router } from 'expo-router';
import { BottomNav, type NavTarget } from './BottomNav';

/** Bottom nav for non-tab screens that should still show it. */
export function StaticBottomNav({ active }: { active?: NavTarget | 'leggUt' }) {
  return (
    <BottomNav
      active={active ?? null}
      onLeggUt={() => router.push('/legg-ut')}
      onNavigate={(target) => {
        const path = target === 'oppdrag' ? '/' : `/${target}`;
        router.replace(path as never);
      }}
    />
  );
}
