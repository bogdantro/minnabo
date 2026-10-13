import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { PersonvernScreen } from '@/screens/PersonvernScreen';
import { consentStore } from '@mocks/data/consentStore';
import { renderWithProviders } from '../testUtils';

test('Personvern shows the consent log and a tips change adds a new row', async () => {
  await renderWithProviders(<PersonvernScreen />);
  expect(await screen.findByText('Vilkår godtatt')).toBeTruthy();
  expect(screen.getByText('Personvernerklæring lest')).toBeTruthy();
  expect(screen.getByText('Alder bekreftet (18+)')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Tips om oppdrag i nærheten'));
  await waitFor(() => expect(consentStore.list()).toHaveLength(2));
  expect(consentStore.list()[0].tips).toBe(false);
  expect(await screen.findByText('Tips om oppdrag slått av')).toBeTruthy();
});

test('retention answers open one at a time; links to Vilkår and Slett konto', async () => {
  await renderWithProviders(<PersonvernScreen />);
  expect(screen.getByText(/Så lenge du har konto/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Meldinger og bilder'));
  expect(screen.queryByText(/Så lenge du har konto/)).toBeNull();
  // the periods the nightly clean-up (0064) really uses
  expect(screen.getByText(/slettes 24 måneder etter siste melding/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Kontoer som ikke brukes'));
  expect(screen.getByText(/ikke er brukt på 24 måneder, slettes\. Du får et varsel i appen 30 dager før/)).toBeTruthy();
  expect(screen.getByText('Vilkår for bruk')).toBeTruthy();
  expect(screen.getByText('Slett konto')).toBeTruthy();
});
