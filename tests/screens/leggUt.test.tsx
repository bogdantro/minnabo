import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TaskRequestForm } from '@/screens/LeggUt/TaskRequestForm';
import { PreviewScreen } from '@/screens/LeggUt/PreviewScreen';
import { buildTaskListing, buildOfferListing } from '@/screens/LeggUt/buildListing';
import { draftStore } from '@/data/draftStore';
import { repositories } from '@/data/repositories';
import { renderWithProviders } from '../testUtils';

const TASK = {
  categorySlug: 'snomaking',
  title: 'Måke snø',
  description: 'Innkjørsel og trapp',
  images: [] as string[],
  place: 'Hamar',
  area: '',
  dateMode: 'ASAP' as const,
  date: null,
  timeFrom: '',
  timeTo: '',
  duration: 'Under 1 time',
  priceMode: 'BUDGET' as const,
  amountKr: '400',
  equipCanBorrow: true,
  equipBringOwn: false,
  equipExtra: '',
  whoCanOffer: 'ALL_VERIFIED' as const,
  isDugnad: false,
  recurrence: '' as const,
  confirmed: true,
};

const OFFER = {
  categorySlug: 'snomaking',
  title: 'Jeg kan måke snø',
  about: 'Rask og pålitelig',
  images: [] as string[],
  services: ['Snømåking'],
  experience: '3 års erfaring',
  experienceText: '',
  place: 'Hamar',
  maxDistanceKm: 10,
  days: ['Man', 'Tir'],
  timeOfDay: ['Morgen'],
  timeFrom: '06:00',
  timeTo: '10:00',
  ownTransport: true,
  priceMode: 'BY_AGREEMENT' as const,
  amountKr: '',
  priceUnit: 'per oppdrag' as const,
  whoCanContact: 'ALL_VERIFIED' as const,
  confirmed: true,
};

beforeEach(() => {
  draftStore.clear();
  repositories.listings._reset();
});

test('buildTaskListing keeps type explicit and price in NOK minor units', () => {
  const l = buildTaskListing(TASK);
  expect(l.type).toBe('TASK_REQUEST');
  expect(l.priceMode).toBe('BUDGET');
  expect(l.price).toEqual({ amountMinor: 40000, currency: 'NOK' });
  expect(l.task?.meetingNote).toMatch(/Adresse deles/);
  expect(l.task?.equipment).toBe('Kan lånes');
});

test('a dugnad task carries no price and the dugnad flag', () => {
  const l = buildTaskListing({ ...TASK, isDugnad: true, amountKr: '400', priceMode: 'BUDGET' });
  expect(l.price).toBeUndefined();
  expect(l.priceMode).toBe('BY_AGREEMENT');
  expect(l.task?.isDugnad).toBe(true);
});

test('a recurring task records its cadence', () => {
  const l = buildTaskListing({ ...TASK, recurrence: 'BIWEEKLY' });
  expect(l.task?.recurrence).toBe('BIWEEKLY');
});

test('buildOfferListing keeps type explicit and no price when by agreement', () => {
  const l = buildOfferListing(OFFER);
  expect(l.type).toBe('SERVICE_OFFER');
  expect(l.price).toBeUndefined();
  expect(l.offer?.services).toEqual(['Snømåking']);
  expect(l.offer?.maxDistanceKm).toBe(10);
});

test('the task wizard blocks empty step 1 and reaches the preview', async () => {
  await renderWithProviders(<TaskRequestForm />);

  await fireEvent.press(screen.getByText('Neste'));
  await waitFor(() => expect(screen.getByText('Velg en kategori.')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Hage' }));
  await fireEvent.changeText(screen.getByLabelText('Tittel på oppdraget'), 'Vaske vinduer');
  await fireEvent.changeText(screen.getByLabelText('Beskrivelse'), 'Alle vinduer i første etasje');
  await fireEvent.press(screen.getByText('Neste')); // -> step 2 (images)

  await waitFor(() => expect(screen.getByText('Legg til bilder')).toBeTruthy());
  await fireEvent.press(screen.getByText('Neste')); // -> step 3

  await waitFor(() => expect(screen.getByText('Hvor og når?')).toBeTruthy());
  await fireEvent.press(screen.getByText('Neste')); // -> step 4 (place has a default)

  await waitFor(() => expect(screen.getByText('Pris og praktisk informasjon')).toBeTruthy());
});

test('a task template pre-fills the title and description', async () => {
  await renderWithProviders(<TaskRequestForm />);

  await fireEvent.press(screen.getByRole('button', { name: 'Snømåking' }));

  await waitFor(() =>
    expect(screen.getByDisplayValue('Snømåking av innkjørsel og trapp')).toBeTruthy(),
  );
});

test('preview publishes the draft into the listings repository', async () => {
  draftStore.set(buildTaskListing({ ...TASK, title: 'Rydde garasje', priceMode: 'WANT_OFFERS', amountKr: '' }));

  await renderWithProviders(<PreviewScreen />);
  await fireEvent.press(screen.getByLabelText(/Jeg bekrefter/));
  await fireEvent.press(screen.getByText('Publiser oppdrag'));

  await waitFor(() =>
    expect(repositories.listings.list().some((l) => l.title === 'Rydde garasje')).toBe(true),
  );
});
