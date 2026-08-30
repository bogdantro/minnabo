import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useUnreadConversationCount } from '@/api/queries';
import { AppText } from './ui/Text';
import { Icon, type IconName } from './ui/Icon';
import { MenySheet } from './MenySheet';

export type NavTarget = 'oppdrag' | 'fellesskap' | 'innboks';

const LEFT: { target: NavTarget; label: string; icon: IconName }[] = [
  { target: 'oppdrag', label: nb.tabs.oppdrag, icon: 'clipboard' },
  { target: 'fellesskap', label: nb.tabs.fellesskap, icon: 'users' },
];
const RIGHT: { target: NavTarget; label: string; icon: IconName }[] = [
  { target: 'innboks', label: nb.tabs.innboks, icon: 'message-circle' },
];

/**
 * Presentational bottom nav. The router-driven `TabBar` and the static one on
 * the Legg ut choice screen both render this.
 */
export function BottomNav({
  active,
  onNavigate,
  onLeggUt,
}: {
  active: NavTarget | 'leggUt' | null;
  onNavigate: (target: NavTarget) => void;
  onLeggUt: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadInbox = useUnreadConversationCount();

  const slot = (s: { target: NavTarget; label: string; icon: IconName }) => {
    const isActive = active === s.target;
    const badge = s.target === 'innboks' ? unreadInbox : 0;
    return (
      <Pressable
        key={s.target}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={badge > 0 ? `${s.label}, ${badge} ulest` : s.label}
        style={styles.slot}
        onPress={() => onNavigate(s.target)}
      >
        <View>
          <Icon name={s.icon} size={22} color={isActive ? 'lime' : 'navy'} />
          {badge > 0 ? (
            <View style={styles.badge}>
              <AppText variant="meta" weight="bold" color="white" style={styles.badgeText}>
                {badge > 9 ? '9+' : badge}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="meta" weight={isActive ? 'bold' : 'regular'} color={isActive ? 'lime' : 'navy'}>
          {s.label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <>
      <View style={[styles.bar, { paddingBottom: insets.bottom + tokens.space.sm }]}>
        {LEFT.map(slot)}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: active === 'leggUt' }}
          accessibilityLabel={nb.tabs.leggUt}
          style={styles.slot}
          onPress={onLeggUt}
        >
          <View style={styles.fab}>
            <LinearGradient
              colors={[tokens.color.lime, tokens.color.limeGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Icon name="plus" size={28} color="white" />
          </View>
          <AppText
            variant="meta"
            weight={active === 'leggUt' ? 'bold' : 'regular'}
            color={active === 'leggUt' ? 'lime' : 'navy'}
          >
            {nb.tabs.leggUt}
          </AppText>
        </Pressable>

        {RIGHT.map(slot)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.tabs.meny}
          style={styles.slot}
          onPress={() => setMenuOpen(true)}
        >
          <Icon name="menu" size={22} color="navy" />
          <AppText variant="meta" color="navy">
            {nb.tabs.meny}
          </AppText>
        </Pressable>
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
  slot: { flex: 1, alignItems: 'center', gap: 3 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: tokens.color.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9, lineHeight: 11 },
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
