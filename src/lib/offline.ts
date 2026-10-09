import { useNetworkState } from 'expo-network';

/** True while the device reports no usable connection (`undefined` during the first probe = online). */
export function useIsOffline(): boolean {
  const net = useNetworkState();
  return net.isConnected === false || net.isInternetReachable === false;
}
