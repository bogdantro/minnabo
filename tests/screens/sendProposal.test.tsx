import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SendProposalScreen } from '@/screens/SendProposalScreen';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { ServiceOfferDetailScreen } from '@/screens/ServiceOfferDetailScreen';
import { InnboksScreen } from '@/screens/InnboksScreen';
import { chatRepository } from '@/data/chatRepository';
import { repositories } from '@/data/repositories';
import { renderWithProviders } from '../testUtils';

const settle = () => new Promise((r) => setTimeout(r, 400));

beforeEach(() => {
  jest.clearAllMocks();
  chatRepository._reset();
  repositories.listings._reset();
});

/** Mount two screens under one shared QueryClient, the way a real app does. */
function renderTogether(a: React.ReactElement, b: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <QueryClientProvider client={qc}>
        <View>
          {a}
          {b}
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

test('giving an offer creates a SENT proposal and lands the user in the new chat', async () => {
  await renderWithProviders(<SendProposalScreen listingId="l-vaskehjelp" mode="give" />);
  await settle();

  await fireEvent.changeText(screen.getByLabelText('Foreslått pris (kr)'), '550');
  await fireEvent.press(screen.getByText('Send tilbud'));

  await waitFor(() => expect(router.replace).toHaveBeenCalled());

  const proposals = chatRepository.proposalsForListing('l-vaskehjelp');
  expect(proposals).toHaveLength(1);
  expect(proposals[0].status).toBe('SENT');
  expect(proposals[0].price.amountMinor).toBe(55000);

  expect((router.replace as jest.Mock).mock.calls.at(-1)![0]).toBe(
    `/chat/${proposals[0].conversationId}`,
  );
});

test('the sent proposal shows up in the inbox without a manual refetch', async () => {
  renderTogether(
    <InnboksScreen />,
    <SendProposalScreen listingId="l-vaskehjelp" mode="give" />,
  );
  await settle();
  // Only the form's own listing-title line shows it before anything is sent.
  expect(screen.getAllByText('Vaskehjelp før visning')).toHaveLength(1);

  await fireEvent.changeText(screen.getByLabelText('Foreslått pris (kr)'), '550');
  await fireEvent.press(screen.getByText('Send tilbud'));

  // Once sent, the inbox list should also carry a row for it — with no manual refetch.
  await waitFor(() =>
    expect(screen.getAllByText('Vaskehjelp før visning')).toHaveLength(2),
  );
});

test('requesting an offer sends a message instead of a proposal', async () => {
  await renderWithProviders(<SendProposalScreen listingId="l-tilbyr-gressklipping" mode="request" />);
  await settle();

  await fireEvent.press(screen.getByText('Send forespørsel'));

  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(chatRepository.proposalsForListing('l-tilbyr-gressklipping')).toHaveLength(0);
  const convId = (router.replace as jest.Mock).mock.calls.at(-1)![0].replace('/chat/', '');
  const messages = chatRepository.getMessages(convId);
  expect(messages.some((m) => m.text.includes('Kan du sende meg et konkret tilbud'))).toBe(true);
});

test('an empty price is rejected before any conversation is started', async () => {
  await renderWithProviders(<SendProposalScreen listingId="l-vaskehjelp" mode="give" />);
  await settle();

  await fireEvent.press(screen.getByText('Send tilbud'));

  await waitFor(() => expect(screen.getByText('Skriv inn en pris.')).toBeTruthy());
  expect(router.replace).not.toHaveBeenCalled();
  expect(chatRepository.proposalsForListing('l-vaskehjelp')).toHaveLength(0);
});

test('the owner of a task sees "Se mottatte tilbud" instead of "Gi tilbud"', async () => {
  const listing = repositories.listings.get('l-male-gjerdet')!; // owned by the current user
  await renderWithProviders(<TaskDetailScreen listing={listing} onBack={() => {}} />);
  await settle();

  expect(screen.getByText('Se mottatte tilbud')).toBeTruthy();
  expect(screen.queryByText('Gi tilbud')).toBeNull();
  expect(screen.queryByText('Send melding')).toBeNull();
});

test('a task owned by someone else still shows "Gi tilbud"', async () => {
  const listing = repositories.listings.get('l-klippe-plen')!; // owned by jonas
  await renderWithProviders(<TaskDetailScreen listing={listing} onBack={() => {}} />);
  await settle();

  expect(screen.getByText('Gi tilbud')).toBeTruthy();
  expect(screen.getByText('Send melding')).toBeTruthy();
});

test('a stray deep link to give an offer on your own listing is blocked, not a raw error', async () => {
  await renderWithProviders(<SendProposalScreen listingId="l-male-gjerdet" mode="give" />);
  await settle();

  expect(screen.getByText('Dette er din egen annonse.')).toBeTruthy();
  expect(screen.queryByLabelText('Foreslått pris (kr)')).toBeNull();
});

test('the owner of a service offer does not see "Ta kontakt" on their own ad', async () => {
  const listing = repositories.listings.get('l-tilbyr-gressklipping')!;
  const mine = { ...listing, owner: repositories.listings.get('l-male-gjerdet')!.owner };
  await renderWithProviders(<ServiceOfferDetailScreen listing={mine} onBack={() => {}} />);
  await settle();

  expect(screen.queryByText('Ta kontakt')).toBeNull();
  expect(screen.queryByText('Be om tilbud')).toBeNull();
});
