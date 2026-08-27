import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon, type IconName } from './ui/Icon';
import { MenySheet } from './MenySheet';

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

type NavSlot = { kind: 'route'; name: string; label: string; icon: IconName };
type ActionSlot = { kind: 'action'; id: 'leggUt' | 'meny'; label: string; icon: IconName };
type Slot = NavSlot | ActionSlot;

const LEFT: NavSlot[] = [
  { kind: 'route', name: 'index', label: nb.tabs.oppdrag, icon: 'clipboard' },
  { kind: 'route', name: 'fellesskap', label: nb.tabs.fellesskap, icon: 'users' },
];
const RIGHT: Slot[] = [
  { kind: 'route', name: 'innboks', label: nb.tabs.innboks, icon: 'message-circle' },
  { kind: 'action', id: 'meny', label: nb.tabs.meny, icon: 'menu' },
];

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeName = state.routes[state.index]?.name;

  const renderNav = (slot: NavSlot) => {
    const active = activeName === slot.name;
    return (
      <Pressable
        key={slot.name}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={slot.label}
        style={styles.slot}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: state.routes.find((r) => r.name === slot.name)?.key ?? slot.name,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            navigation.navigate(slot.name);
          }
        }}
      >
        <Icon name={slot.icon} size={22} color={active ? 'lime' : 'navy'} />
        <AppText variant="meta" weight={active ? 'bold' : 'regular'} color={active ? 'lime' : 'navy'}>
          {slot.label}
        </AppText>
      </Pressable>
    );
  };

  const renderRight = (slot: Slot) => {
    if (slot.kind === 'route') return renderNav(slot);
    return (
      <Pressable
        key={slot.id}
        accessibilityRole="button"
        accessibilityLabel={slot.label}
        style={styles.slot}
        onPress={() => setMenuOpen(true)}
      >
        <Icon name={slot.icon} size={22} color="navy" />
        <AppText variant="meta" color="navy">
          {slot.label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <>
      <View style={[styles.bar, { paddingBottom: insets.bottom + tokens.space.sm }]}>
        {LEFT.map(renderNav)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.tabs.leggUt}
          style={styles.slot}
          onPress={() => router.push('/legg-ut')}
        >
          <View style={styles.fab}>
            <LinearGradient
              colors={[tokens.color.lime, tokens.color.limeGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Icon name="plus" size={28} color="navy" />
          </View>
          <AppText variant="meta" color="navy">
            {nb.tabs.leggUt}
          </AppText>
        </Pressable>

        {RIGHT.map(renderRight)}
      </View>

      <MenySheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    paddingTop: tokens.space.sm,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: tokens.color.surface,
    ...tokens.shadow.fab,
  },
});
