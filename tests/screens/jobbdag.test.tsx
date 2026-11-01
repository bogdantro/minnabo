import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { JobbdagScreen } from '@/screens/JobbdagScreen';
import { renderWithProviders } from '../testUtils';

const ID = 'p-martin-flytting';

test('timer starts and pauses; live pill follows', async () => {
  await renderWithProviders(<JobbdagScreen proposalId={ID} />);
  expect(await screen.findByText('Arbeidstid i dag')).toBeTruthy();
  expect(screen.getByText('Ikke startet')).toBeTruthy();
  expect(screen.getByText('Klar')).toBeTruthy();
  await fireEvent.press(screen.getByText('Start'));
  await waitFor(() => expect(screen.getByText('I gang')).toBeTruthy());
  await fireEvent.press(screen.getByText('Pause'));
  await waitFor(() => expect(screen.getByText('På pause')).toBeTruthy());
});

test('checklist: add a task, tick it, and see the progress', async () => {
  await renderWithProviders(<JobbdagScreen proposalId={ID} />);
  await screen.findByText('Arbeidstid i dag');
  await fireEvent.changeText(screen.getByLabelText('Ny oppgave'), 'Bære sofaen');
  await fireEvent.press(screen.getByText('Legg til'));
  const task = await screen.findByLabelText('Bære sofaen');
  await fireEvent.press(task);
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Bære sofaen', checked: true })).toBeTruthy());
});

test('materials: add one through the sheet and see the sum', async () => {
  await renderWithProviders(<JobbdagScreen proposalId={ID} />);
  await screen.findByText('Arbeidstid i dag');
  await fireEvent.press(screen.getByRole('tab', { name: /Materialer/ }));
  await fireEvent.press(screen.getByText('Legg til materiale'));
  await fireEvent.press(screen.getAllByText('Legg til').at(-1)!);
  expect(screen.getByText('Skriv hva du legger til')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Navn'), 'Flyttebokser');
  await fireEvent.changeText(screen.getByLabelText('Beløp'), '250');
  await fireEvent.press(screen.getAllByText('Legg til').at(-1)!);
  await waitFor(() => expect(screen.getByText('Flyttebokser')).toBeTruthy());
  expect(screen.getAllByText('250 kr').length).toBeGreaterThan(0);
});

test('checklist: «Fra oppdraget» adds what the owner ticked, then disappears', async () => {
  const { listings } = jest.requireActual('@mocks/data/seed') as typeof import('@mocks/data/seed');
  const l = listings.find((x) => x.id === 'l-flytting')!;
  l.category = { ...l.category, slug: 'flytting' };
  l.task = { ...l.task!, intake: [{ label: 'Hva skal bæres?', value: 'Møbler, Esker' }] };
  await renderWithProviders(<JobbdagScreen proposalId={ID} />);
  await screen.findByText('Arbeidstid i dag');
  expect(await screen.findByText('Fra oppdraget')).toBeTruthy();
  await fireEvent.press(screen.getByText('Legg til alle'));
  expect(await screen.findByLabelText('Møbler')).toBeTruthy();
  expect(screen.getByLabelText('Esker')).toBeTruthy();
  await waitFor(() => expect(screen.queryByText('Fra oppdraget')).toBeNull());
});
