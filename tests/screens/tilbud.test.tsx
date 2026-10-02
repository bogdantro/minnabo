import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { MottatteTilbudScreen } from '@/screens/MottatteTilbudScreen';
import { SammenlignTilbudScreen } from '@/screens/SammenlignTilbudScreen';
import { TilbudDetaljScreen } from '@/screens/TilbudDetaljScreen';
import { AvtaleSammendragScreen } from '@/screens/AvtaleSammendragScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { renderWithProviders } from '../testUtils';

const settle = () => new Promise((r) => setTimeout(r, 400));

test('Mottatte tilbud groups proposals by oppdrag with a summary and status pills', async () => {
  await renderWithProviders(<MottatteTilbudScreen />);
  await settle();
  expect(screen.getAllByText('Mottatte tilbud').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Male gjerdet').length).toBeGreaterThan(0);
  expect(screen.getByText('totalt')).toBeTruthy();
  expect(screen.getAllByText('Ny').length).toBeGreaterThan(0);
  expect(screen.getByText('Sammenlign')).toBeTruthy();
  expect(screen.getByText(/MinNabo håndterer ikke betaling/)).toBeTruthy();
});

test('Mottatte tilbud: "Besvart" filters to answered offers and shows the empty state', async () => {
  await renderWithProviders(<MottatteTilbudScreen />);
  await settle();
  await fireEvent.press(screen.getByRole('tab', { name: /^Besvart/ }));
  expect(screen.queryAllByText('Ny')).toHaveLength(0);
});

test('Sammenlign shows every proposal on the listing, cheapest first', async () => {
  await renderWithProviders(<SammenlignTilbudScreen listingId="l-male-gjerdet" />);
  await settle();
  expect(screen.getAllByText('Sammenlign tilbud').length).toBeGreaterThan(0);
  expect(screen.getByText(/1.900.kr/)).toBeTruthy();
  expect(screen.getByText(/2.600.kr/)).toBeTruthy();
});

test('accepting a proposal creates an agreement shown on the avtale screen', async () => {
  await renderWithProviders(<TilbudDetaljScreen proposalId="p-gjerde-martin" />);
  await settle();
  await fireEvent.press(screen.getByText('Godta tilbud'));
  await waitFor(() =>
    expect(chatRepository.getProposal('p-gjerde-martin')?.status).toBe('ACCEPTED'),
  );
  expect(chatRepository.getAgreement('p-gjerde-martin')).toBeDefined();

  await renderWithProviders(<AvtaleSammendragScreen proposalId="p-gjerde-martin" />);
  await settle();
  expect(screen.getByText('Dere har en avtale')).toBeTruthy();
});

test('requesting a revision moves the proposal to REVISION_PENDING', async () => {
  await renderWithProviders(<TilbudDetaljScreen proposalId="p-gjerde-emma" />);
  await settle();
  await fireEvent.press(screen.getByText('Be om endring'));
  await waitFor(() => expect(screen.getByText(/Hva vil du ha endret/)).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Hva vil du ha endret?'), 'Lavere pris takk');
  await fireEvent.press(screen.getByText('Send forespørsel'));
  await waitFor(() =>
    expect(chatRepository.getProposal('p-gjerde-emma')?.status).toBe('REVISION_PENDING'),
  );
});
