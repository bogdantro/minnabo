import { router } from 'expo-router';
import { BottomNav, type NavTarget } from './BottomNav';

type TabRoute = { key: string; name: string };
export type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: boolean;
    }) => { defaultPrevented: boolean };
  };
};

const ROUTE_TO_TARGET: Record<string, NavTarget> = {
  index: 'oppdrag',
  fellesskap: 'fellesskap',
  innboks: 'innboks',
};
const TARGET_TO_ROUTE: Record<NavTarget, string> = {
  oppdrag: 'index',
  fellesskap: 'fellesskap',
  innboks: 'innboks',
};

export function TabBar({ state, navigation }: TabBarProps) {
  const activeRoute = state.routes[state.index]?.name;
  const active = activeRoute ? (ROUTE_TO_TARGET[activeRoute] ?? null) : null;

  return (
    <BottomNav
      active={active}
      onLeggUt={() => router.push('/legg-ut')}
      onNavigate={(target) => {
        const routeName = TARGET_TO_ROUTE[target];
        const route = state.routes.find((r) => r.name === routeName);
        const event = navigation.emit({
          type: 'tabPress',
          target: route?.key ?? routeName,
          canPreventDefault: true,
        });
        if (activeRoute !== routeName && !event.defaultPrevented) {
          navigation.navigate(routeName);
        }
      }}
    />
  );
}
