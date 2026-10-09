import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { LeggUtWizard } from '@/screens/LeggUt/LeggUtWizard';
import { apiClient } from '@/api/client';
import { draftStore } from '@/data/draftStore';
import {
  applyCategory,
  emptyWizard,
  extrasFor,
  intakeOf,
  validateStep,
  wizardFromListing,
} from '@/screens/LeggUt/wizardModel';
import { FORMS } from '@/screens/LeggUt/wizardConfig';
import { categoryLabels, type CategoryId } from '@/theme/theme';
import { CATEGORIES, categoryArtId } from '@/domain/categories';
import { chatRepository } from '@mocks/data/chatRepository';
import { repositories } from '@mocks/data/repositories';
import { renderWithProviders } from '../testUtils';

const settle = () => new Promise((r) => setTimeout(r, 400));
const task = () => repositories.listings.get('l-vaskehjelp')!; // Emma's, budget 900 kr
const mine = () => chatRepository.proposalsForListing('l-vaskehjelp').filter((p) => p.fromProfileId === 'u-mb');

test('a sent tilbud can be edited: prefilled sheet → Lagre endringene → price updated, still SENT', async () => {
  await renderWithProviders(<TaskDetailScreen listing={task()} onBack={() => {}} />);
  await settle();
  await fireEvent.press(screen.getByText('Gi tilbud'));
  await fireEvent.changeText(screen.getByLabelText('Beløp i kroner'), '850');
  await fireEvent.changeText(screen.getByLabelText('Melding til Emma'), 'Hei! Jeg kan komme i morgen.');
  await fireEvent.press(screen.getByText('Se over tilbudet'));
  await fireEvent.press(screen.getByText('Send tilbud'));
  await waitFor(() => expect(mine()).toHaveLength(1));

  await fireEvent.press(await screen.findByText('Endre tilbud'));
  expect(await screen.findByText('Endre tilbudet')).toBeTruthy();
  // prefilled from the sent tilbud
  expect(screen.getByDisplayValue('850')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Beløp i kroner'), '950');
  await fireEvent.press(screen.getByText('Se over tilbudet'));
  await fireEvent.press(screen.getByText('Lagre endringene'));

  await waitFor(() => expect(mine()[0].price.amountMinor).toBe(95000));
  expect(mine()[0].status).toBe('SENT');
  expect(mine()).toHaveLength(1); // edited, not a second tilbud
  expect(await screen.findByText('Tilbudet er oppdatert – Emma får beskjed')).toBeTruthy();
});

test('the owner gets "Rediger" next to "Se mottatte tilbud"', async () => {
  const listing = repositories.listings.get('l-male-gjerdet')!;
  await renderWithProviders(<TaskDetailScreen listing={listing} onBack={() => {}} />);
  await settle();
  expect(screen.getByText('Rediger')).toBeTruthy();
  expect(screen.getByText('Se mottatte tilbud')).toBeTruthy();
});

test('updateListing (mock) changes the oppdrag, keeps its id, and stores the form for the next edit', async () => {
  const before = repositories.listings.get('l-male-gjerdet')!;
  const s = { ...wizardFromListing(before, null), title: 'Male gjerdet og porten' };
  const updated = await apiClient.updateListing(before.id, { ...before, title: s.title }, extrasFor(s));
  expect(updated.id).toBe(before.id);
  expect(repositories.listings.get(before.id)!.title).toBe('Male gjerdet og porten');
  expect(updated.editedAt).toBeTruthy();
  const data = await apiClient.getListingEditData(before.id);
  expect((data.wizard as { title: string }).title).toBe('Male gjerdet og porten');
});

test('the wizard opens in edit mode with the oppdrag filled in, and preview carries the edit id', async () => {
  const router = require('expo-router');
  const spy = jest.spyOn(router, 'useLocalSearchParams').mockReturnValue({ rediger: 'l-male-gjerdet', tilbake: '/mine' });
  try {
    await renderWithProviders(<LeggUtWizard />);
    expect(await screen.findByText('Rediger oppdrag')).toBeTruthy();
    // opens on the summary (step 9) with the existing title
    expect((await screen.findAllByText(repositories.listings.get('l-male-gjerdet')!.title)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Lagre utkast')).toBeNull(); // no drafts while editing
    // This older oppdrag has no answer to the category's required question:
    // "Se endringene" takes you there instead of saving half a form.
    await fireEvent.press(screen.getByText('Se endringene'));
    expect(await screen.findByText('Velg minst ett alternativ.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Gjerde' }));
    await fireEvent.press(screen.getByText('Lagre og se oversikt'));
    await fireEvent.press(await screen.findByText('Se endringene'));
    expect(draftStore.meta().editId).toBe('l-male-gjerdet');
    expect(draftStore.get()!.task!.intake).toContainEqual({ label: 'Hva skal males?', value: 'Gjerde' });
    expect(draftStore.meta().back).toBe('/mine');
  } finally {
    spy.mockRestore();
    draftStore.clear();
  }
});

test('every category has its own form, and the catalogue, labels and forms agree', () => {
  const ids = Object.keys(categoryLabels) as CategoryId[];
  expect(ids.length).toBeGreaterThanOrEqual(23);
  for (const id of ids) {
    const f = FORMS[id];
    expect(f.fields.length).toBeGreaterThanOrEqual(3);
    expect(f.titles.length).toBeGreaterThan(0);
    expect(f.price[0]).toBeLessThan(f.price[1]);
  }
  // every catalogue slug maps to an art id with a form
  for (const c of CATEGORIES) expect(FORMS[categoryArtId(c.slug)]).toBeTruthy();
});

test('category logic: defaults, required questions and intake rows', () => {
  const s0 = { ...emptyWizard('Lillehammer'), ...applyCategory(emptyWizard(), 'flytting') };
  expect(s0.helpers).toBe(2); // moving needs two by default
  expect(s0.hours).toBe(3);
  const desc = 'Sofa og to kommoder fra tredje etasje til henger.';
  // "Hva skal bæres?" is required
  expect(validateStep(3, { ...s0, desc })?.field).toBe('q:what');
  const s1 = { ...s0, desc, answers: { ...s0.answers, what: ['Møbler', 'Esker'] }, urgent: true };
  expect(validateStep(3, s1)).toBeNull();
  const rows = intakeOf(s1);
  expect(rows).toContainEqual({ label: 'Hva skal bæres?', value: 'Møbler, Esker' });
  expect(rows).toContainEqual({ label: 'Etasjer å bære', value: '2 etg.' });
  expect(rows).toContainEqual({ label: 'Antall hjelpere', value: '2 personer' });
  expect(rows).toContainEqual({ label: 'Haster', value: 'Ja' });
  // settings for the backend
  expect(extrasFor({ ...s1, who: 'verif', priceMode: 'offer', amount: '1200', km: 7 })).toMatchObject({
    offerAudience: 'VERIFIED',
    maxDistanceKm: 7,
    privateEstimateMinor: 120000,
    estimatedMinutes: 180,
  });
});
