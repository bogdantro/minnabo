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

test('Sammenlign shows a column per open offer with "Lavest pris" and a price range', async () => {
  await renderWithProviders(<SammenlignTilbudScreen listingId="l-male-gjerdet" />);
  await settle();
  expect(screen.getAllByText('Sammenlign tilbud').length).toBeGreaterThan(0);
  expect(screen.getByText(/1.900.kr/)).toBeTruthy();
  expect(screen.getAllByText(/2.600.kr/).length).toBeGreaterThan(0);
  expect(screen.getByText('Lavest pris')).toBeTruthy();
  expect(screen.getByText('Prisspenn')).toBeTruthy();
});

test('Sammenlign: picking a column enables "Gå videre med …"', async () => {
  await renderWithProviders(<SammenlignTilbudScreen listingId="l-male-gjerdet" />);
  await settle();
  expect(screen.getByText('Trykk på et tilbud for å velge det')).toBeTruthy();
  await fireEvent.press(screen.getAllByRole('radio')[0]);
  expect(screen.getByText(/^Gå videre med /)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Fjern valg'));
  expect(screen.getByText('Trykk på et tilbud for å velge det')).toBeTruthy();
});

test('Godta needs the acknowledgement, then creates an agreement and shows the success screen', async () => {
  await renderWithProviders(<TilbudDetaljScreen proposalId="p-gjerde-martin" />);
  await settle();
  expect(await screen.findByText('Tilbud fra Martin')).toBeTruthy();
  await fireEvent.press(screen.getByText('Godta tilbud'));
  expect(screen.getByText('Dette blir avtalegrunnlaget')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Bekreft og godta'));
  expect(screen.getByText('Kryss av for å bekrefte før du godtar.')).toBeTruthy();
  expect(chatRepository.getProposal('p-gjerde-martin')?.status).toBe('SENT');

  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByLabelText('Bekreft og godta'));
  await waitFor(() => expect(chatRepository.getProposal('p-gjerde-martin')?.status).toBe('ACCEPTED'));
  await waitFor(() => expect(screen.getByText('Avtale inngått med Martin!')).toBeTruthy());
  expect(chatRepository.getAgreement('p-gjerde-martin')).toBeDefined();

  await renderWithProviders(<AvtaleSammendragScreen proposalId="p-gjerde-martin" />);
  await settle();
  expect(screen.getByText('Dere har en avtale')).toBeTruthy();
});

test('Be om endring needs a topic, then moves the proposal to REVISION_PENDING', async () => {
  await renderWithProviders(<TilbudDetaljScreen proposalId="p-gjerde-emma" />);
  await settle();
  await fireEvent.press(screen.getByText('Be om endring'));
  await fireEvent.press(screen.getByText('Send forespørsel'));
  expect(screen.getByText('Velg hva endringen gjelder.')).toBeTruthy();

  await fireEvent.press(screen.getByText('Pris'));
  await fireEvent.changeText(screen.getByLabelText('Melding til Emma'), 'Lavere pris takk');
  await fireEvent.press(screen.getByText('Send forespørsel'));
  await waitFor(() => expect(chatRepository.getProposal('p-gjerde-emma')?.status).toBe('REVISION_PENDING'));
});

test('Avslå is held for "Angre" and only then sent', async () => {
  jest.useFakeTimers();
  try {
    await renderWithProviders(<TilbudDetaljScreen proposalId="p-gjerde-andreas" />);
    await jest.advanceTimersByTimeAsync(400);
    await fireEvent.press(screen.getByText('Avslå'));
    await fireEvent.press(screen.getByText('Prisen passer ikke'));
    await fireEvent.press(screen.getByText('Avslå tilbudet'));
    expect(screen.getByText('Du har avslått dette tilbudet')).toBeTruthy();
    expect(chatRepository.getProposal('p-gjerde-andreas')?.status).toBe('SENT');

    await jest.advanceTimersByTimeAsync(6000);
    await waitFor(() => expect(chatRepository.getProposal('p-gjerde-andreas')?.status).toBe('DECLINED'));
  } finally {
    jest.useRealTimers();
  }
});
