import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import nb from '@/i18n/nb';
import { appSettingsKeys, useAppSettings } from '@/api/queries';
import { colors } from '@/theme/theme';
import { StateView } from '@/components/ui';

/**
 * Maintenance mode (website › Innstillinger › Generelt, app_settings
 * `platform.maintenance_mode`): the whole app is replaced by "Vi oppdaterer MinNabo" with
 * "Prøv igjen". It lifts by itself when the switch is turned off (PlatformRealtime), or on retry.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { maintenance } = useAppSettings();
  const qc = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  if (!maintenance) return <>{children}</>;

  const retry = async () => {
    setRetrying(true);
    try {
      await qc.refetchQueries({ queryKey: appSettingsKeys.app });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.fill} accessibilityViewIsModal>
      <StateView
        icon="refresh"
        tone="neutral"
        title={nb.state.maintenanceTitle}
        body={nb.state.maintenanceBody}
        actionLabel={retrying ? nb.state.retrying : nb.state.retry}
        actionLoading={retrying}
        onAction={retry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
});
