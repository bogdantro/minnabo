import { AgreedSumScreen } from '@/screens/AgreedSumScreen';

export default function Route() {
  return <AgreedSumScreen year={new Date().getFullYear()} />;
}
