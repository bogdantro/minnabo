import { ListingListScreen } from '@/screens/ListingListScreen';
import nb from '@/i18n/nb';

export default function Route() {
  return <ListingListScreen type="TASK_REQUEST" title={nb.tasksPage.title} />;
}
