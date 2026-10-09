import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { InnboksScreen } from '@/screens/InnboksScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { repositories } from '@mocks/data/repositories';
import { renderWithProviders } from '../testUtils';

const settle = () => new Promise((r) => setTimeout(r, 400));

beforeEach(() => {
  jest.clearAllMocks();
  chatRepository._reset();
  repositories.listings._reset();
});

const task = () => repositories.listings.get('l-vaskehjelp')!; // owned by Emma, budget 900 kr
const mine = () => chatRepository.proposalsForListing('l-vaskehjelp').filter((p) => p.fromProfileId === 'u-mb');

/** Fill the Gi tilbud form and get to the preview. */
async function fillOffer(amount: string) {
  await fireEvent.press(screen.getByText('Gi tilbud'));
  await fireEvent.changeText(screen.getByLabelText('Beløp i kroner'), amount);
  await fireEvent.changeText(screen.getByLabelText('Melding til Emma'), 'Hei! Jeg kan komme i morgen.');
  await fireEvent.press(screen.getByText('Se over tilbudet'));
}

test('task detail shows the oppdrag, approximate area and actions – no payment UI', async () => {
  await renderWithProviders(<TaskDetailScreen listing={task()} onBack={() => {}} />);
  await settle();
  expect(screen.getByText('Vaskehjelp før visning')).toBeTruthy();
  expect(screen.getByText('Åpent oppdrag')).toBeTruthy();
  expect(screen.getByText('Gi tilbud')).toBeTruthy();
  expect(screen.getByText('Send melding')).toBeTruthy();
  expect(screen.getByText(/MinNabo håndterer ikke betaling/)).toBeTruthy();
  expect(screen.getByText(/Omtrentlig område/)).toBeTruthy();
  expect(screen.queryByText(/Betal nå|betal nå/)).toBeNull();
});

test('the owner sees "Se mottatte tilbud" instead of "Gi tilbud"', async () => {
  const listing = repositories.listings.get('l-male-gjerdet')!; // owned by the current user
  await renderWithProviders(<TaskDetailScreen listing={listing} onBack={() => {}} />);
  await settle();
  expect(screen.getByText('Se mottatte tilbud')).toBeTruthy();
  expect(screen.queryByText('Gi tilbud')).toBeNull();
  expect(screen.queryByText('Send melding')).toBeNull();
});

test('Gi tilbud validates amount and message before the preview', async () => {
  await renderWithProviders(<TaskDetailScreen listing={task()} onBack={() => {}} />);
  await settle();
  await fireEvent.press(screen.getByText('Gi tilbud'));
  await fireEvent.changeText(screen.getByLabelText('Beløp i kroner'), '');
  await fireEvent.press(screen.getByText('Se over tilbudet'));
  expect(screen.getByText('Skriv inn et beløp over 0 kr.')).toBeTruthy();
  expect(screen.getByText('Skriv en kort melding til Emma.')).toBeTruthy();
  expect(mine()).toHaveLength(0);
});

test('sending an offer creates a SENT proposal and the footer offers "Endre tilbud"', async () => {
  await renderWithProviders(<TaskDetailScreen listing={task()} onBack={() => {}} />);
  await settle();
  await fillOffer('850');
  expect(screen.getByText('Slik ser Emma tilbudet')).toBeTruthy();
  expect(screen.getByText('50 kr under budsjett')).toBeTruthy();

  await fireEvent.press(screen.getByText('Send tilbud'));
  await waitFor(() => expect(screen.getByText('Tilbudet er sendt til Emma')).toBeTruthy());

  const proposals = mine();
  expect(proposals).toHaveLength(1);
  expect(proposals[0].status).toBe('SENT');
  expect(proposals[0].price.amountMinor).toBe(85000);
  expect(await screen.findByText('Endre tilbud')).toBeTruthy();
});

test('the sent offer shows up in the inbox without a manual refetch', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  await render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <QueryClientProvider client={qc}>
        <View>
          <InnboksScreen />
          <TaskDetailScreen listing={task()} onBack={() => {}} />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await settle();
  const before = screen.queryAllByText('Vaskehjelp før visning').length;
  await fillOffer('600');
  await fireEvent.press(screen.getByText('Send tilbud'));
  await waitFor(() => expect(screen.getByText('Tilbudet er sendt til Emma')).toBeTruthy(), { timeout: 5000 });
  await waitFor(() => expect(screen.queryAllByText('Vaskehjelp før visning').length).toBeGreaterThan(before), { timeout: 5000 });
});
