import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AvtaleSammendragScreen } from '@/screens/AvtaleSammendragScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { renderWithProviders } from '../testUtils';

beforeEach(() => chatRepository._reset());

// p-martin-flytting: Martin's accepted offer on my "Hjelp med flytting"
const ID = 'p-martin-flytting';

test('shows the locked agreement with parties, progress and actions', async () => {
  await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
  expect(await screen.findByText('Avtalen er klar')).toBeTruthy();
  expect(screen.getByText('Låst avtale')).toBeTruthy();
  expect(screen.getByText('Oppdragsgiver')).toBeTruthy();
  expect(screen.getByText('Oppdragstaker')).toBeTruthy();
  expect(screen.getByText('Fremdrift')).toBeTruthy();
  expect(screen.getByText('Åpne jobbdag')).toBeTruthy();
  expect(screen.getByText(/MinNabo håndterer ikke betaling/)).toBeTruthy();
});

test('Avlys avtalen cancels the agreement with a reason', async () => {
  await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
  await screen.findByText('Avtalen er klar');
  await fireEvent.press(screen.getAllByText('Avlys avtalen')[0]);
  expect(screen.getByText('Avlyse avtalen?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Været'));
  await fireEvent.press(screen.getAllByText('Avlys avtalen').at(-1)!);
  await waitFor(() => expect(chatRepository.getProposal(ID)?.status).toBe('CANCELLED'));
  expect(chatRepository.getAgreement(ID)?.cancelReason).toBe('Været');
  await waitFor(() => expect(screen.getAllByText('Avtalen er avlyst').length).toBe(2), { timeout: 3000 });
  expect(screen.getByText('Se andre tilbud')).toBeTruthy();
});
