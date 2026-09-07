import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { renderWithProviders } from '../testUtils';

const seen = (text: string | RegExp) =>
  waitFor(() => expect(screen.getByText(text)).toBeTruthy(), { timeout: 6000 });

test('shows the hero, search, category row and the "Jobber nær deg" section', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(screen.getByText('Trenger du hjelp raskt?')).toBeTruthy();
  expect(screen.getByText('Søk etter en tjeneste …')).toBeTruthy();
  expect(screen.getByLabelText('Åpne profil')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Alle' })).toBeTruthy();
  await seen('Jobber nær deg');
});

test('the job carousel blends both listing types near the user', async () => {
  await renderWithProviders(<OppdragScreen />);
  await seen('Klippe plen'); // a task request
  expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy(); // a service offer
});

test('only shows listings from the user kommune (Lillehammer)', async () => {
  await renderWithProviders(<OppdragScreen />);
  await seen('Klippe plen');
  await waitFor(
    () => expect(screen.queryByText('Montering og småreparasjoner')).toBeNull(),
    { timeout: 6000 },
  );
});

test('picking the Hage category filters the carousel to hage listings', async () => {
  await renderWithProviders(<OppdragScreen />);
  await seen('Klippe plen');
  await fireEvent.press(screen.getByRole('button', { name: 'Hage' }));
  await waitFor(() => expect(screen.queryByText('Hjelp med flytting')).toBeNull(), { timeout: 6000 });
  expect(screen.getByText('Klippe plen')).toBeTruthy();
});

test('the community teaser links to Fellesskap', async () => {
  await renderWithProviders(<OppdragScreen />);
  await seen('Lokale folk. Reell hjelp.');
  expect(screen.getByRole('button', { name: 'Bli en del' })).toBeTruthy();
});
