import { router } from 'expo-router';
import { BottomNav } from './BottomNav';

/** Bottom nav for non-tab screens that should still show it (Legg ut choice). */
export function StaticBottomNav({ active }: { active?: 'leggUt' }) {
  return (
    <BottomNav
      active={active ?? null}
      onLeggUt={() => {}}
      onNavigate={(target) => {
        const path = target === 'oppdrag' ? '/' : `/${target}`;
        router.replace(path as never);
      }}
    />
  );
}
