import { ListingListScreen } from '@/screens/ListingListScreen';
import { activeProfiles } from '@/data/seed';
import nb from '@/i18n/nb';

export default function Route() {
  return (
    <ListingListScreen
      type="SERVICE_OFFER"
      title={nb.offersPage.title}
      activeProfiles={activeProfiles}
    />
  );
}
