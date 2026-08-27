import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TaskRequestForm } from '@/screens/LeggUt/TaskRequestForm';
import { PreviewScreen } from '@/screens/LeggUt/PreviewScreen';
import { buildTaskListing, buildOfferListing } from '@/screens/LeggUt/buildListing';
import { draftStore } from '@/data/draftStore';
import { repositories } from '@/data/repositories';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  draftStore.clear();
  repositories.listings._reset();
});

test('buildTaskListing produces an explicit TASK_REQUEST with NOK price', () => {
  const listing = buildTaskListing({
    title: 'Måke snø',
    description: 'Innkjørsel og trapp',
    categorySlug: 'snomaking',
    place: 'Hamar',
    scheduledText: 'Fredag',
    durationText: '1 time',
    priceMode: 'FIXED',
    amountKr: '400',
    equipment: 'Har spade',
  });
  expect(listing.type).toBe('TASK_REQUEST');
  expect(listing.price).toEqual({ amountMinor: 40000, currency: 'NOK' });
  expect(listing.task?.meetingNote).toMatch(/Adresse deles/);
});

test('buildOfferListing produces an explicit SERVICE_OFFER', () => {
  const listing = buildOfferListing({
    title: 'Jeg kan måke snø',
    about: 'Rask og pålitelig',
    categorySlug: 'snomaking',
    services: ['Snømåking'],
    experienceYears: '3',
    completedJobs: '12',
    place: 'Hamar',
    maxDistanceKm: '10',
    availabilityText: 'Morgener',
    equipmentText: 'Har freser',
    priceMode: 'BY_AGREEMENT',
    amountKr: '',
  });
  expect(listing.type).toBe('SERVICE_OFFER');
  expect(listing.price).toBeUndefined();
  expect(listing.offer?.services).toEqual(['Snømåking']);
});

test('filling the task wizard reaches the preview and validation blocks empty steps', async () => {
  await renderWithProviders(<TaskRequestForm />);

  // step 1 blocked until required fields are filled
  await fireEvent.press(screen.getByText('Neste'));
  await waitFor(() =>
    expect(screen.getByText('Dette feltet må fylles ut.')).toBeTruthy(),
  );

  await fireEvent.changeText(screen.getByLabelText('Tittel'), 'Vaske vinduer');
  await fireEvent.press(screen.getByRole('button', { name: 'Rengjøring' }));
  await fireEvent.changeText(
    screen.getByLabelText('Beskrivelse'),
    'Alle vinduer i første etasje',
  );
  await fireEvent.press(screen.getByText('Neste'));

  await waitFor(() => expect(screen.getByLabelText('Sted')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Sted'), 'Lillehammer');
  await fireEvent.press(screen.getByText('Neste'));

  await waitFor(() => expect(screen.getByLabelText('Beløp (kr)')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Beløp (kr)'), '750');
  await fireEvent.press(screen.getByText('Forhåndsvisning'));

  await waitFor(() => expect(draftStore.get()?.title).toBe('Vaske vinduer'));
});

test('preview publishes the draft into the listings repository', async () => {
  draftStore.set(
    buildTaskListing({
      title: 'Rydde garasje',
      description: 'Bære ut og sortere',
      categorySlug: 'flytting',
      place: 'Gjøvik',
      scheduledText: '',
      durationText: '',
      priceMode: 'BY_AGREEMENT',
      amountKr: '',
      equipment: '',
    }),
  );

  await renderWithProviders(<PreviewScreen />);
  await fireEvent.press(screen.getByText('Publiser'));

  await waitFor(() =>
    expect(repositories.listings.list().some((l) => l.title === 'Rydde garasje')).toBe(true),
  );
});
