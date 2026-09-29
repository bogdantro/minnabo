import { screen } from '@testing-library/react-native';
import { listings } from '@mocks/data/seed';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { ServiceOfferDetailScreen } from '@/screens/ServiceOfferDetailScreen';
import { renderWithProviders } from '../testUtils';

const task = listings.find((l) => l.id === 'l-klippe-plen')!;
const offer = listings.find((l) => l.id === 'l-tilbyr-gressklipping')!;

test('task detail uses request terminology and actions', async () => {
  await renderWithProviders(<TaskDetailScreen listing={task} onBack={() => {}} />);
  expect(screen.getByText('Oppdragsdetaljer')).toBeTruthy();
  expect(screen.getByText('Klippe plen')).toBeTruthy();
  expect(screen.getByText('Åpent oppdrag')).toBeTruthy();
  expect(screen.getByText('Gi tilbud')).toBeTruthy();
  expect(screen.getByText('Send melding')).toBeTruthy();
  expect(screen.getByText('Pris og betaling avtales mellom dere.')).toBeTruthy();
  expect(screen.getByText(/Adresse deles når tilbud er godtatt/)).toBeTruthy();
});

test('service offer detail uses offer terminology and actions', async () => {
  await renderWithProviders(<ServiceOfferDetailScreen listing={offer} onBack={() => {}} />);
  expect(screen.getByText('Tilgjengelig for småjobber')).toBeTruthy();
  expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
  expect(screen.getByText('Tilbyr hjelp')).toBeTruthy();
  expect(screen.getByText('Ta kontakt')).toBeTruthy();
  expect(screen.getByText('Be om tilbud')).toBeTruthy();
  expect(screen.getByText('Pris og betaling avtales direkte mellom dere.')).toBeTruthy();
  expect(screen.getByText('Gressklipping')).toBeTruthy();
});

test('neither detail screen mentions payment', async () => {
  const { unmount } = await renderWithProviders(
    <TaskDetailScreen listing={task} onBack={() => {}} />,
  );
  expect(screen.queryByText(/Vipps|Betal nå|betal nå/)).toBeNull();
  unmount();
  await renderWithProviders(<ServiceOfferDetailScreen listing={offer} onBack={() => {}} />);
  expect(screen.queryByText(/Vipps|Betal nå|betal nå/)).toBeNull();
});
