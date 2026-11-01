import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { chatRepository } from '@mocks/data/chatRepository';
import { noShowStore } from '@mocks/data/noShowStore';
import { repositories } from '@mocks/data/repositories';
import { profileRepository } from '@mocks/data/profileRepository';
import { apiClient } from '@/api/client';
import { AvtaleSammendragScreen } from '@/screens/AvtaleSammendragScreen';
import { TilbudDetaljScreen } from '@/screens/TilbudDetaljScreen';
import { UteblittScreen } from '@/screens/UteblittScreen';
import { canReportNoShow, noShowWindowOpen, weightNow } from '@/domain/noShow';
import { isUrgent } from '@/domain/urgent';
import { renderWithProviders } from '../testUtils';

const ME = profileRepository.currentUserId;
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
/** Today at a time that's still ahead – the job day. */
const laterToday = () => {
  const d = new Date();
  d.setHours(Math.min(23, d.getHours() + 1), 30, 0, 0);
  return d.toISOString();
};

/** I (the owner) accepted Andreas' tilbud on «Male gjerdet»; Emma and Martin also gave tilbud. */
function acceptAndreas(scheduledAt: string) {
  chatRepository.respondToProposal('p-gjerde-andreas', 'ACCEPT', 'RECIPIENT');
  chatRepository.patchAgreement('p-gjerde-andreas', { scheduledAt });
}

// ------------------------------------------------------------
// Rules
// ------------------------------------------------------------
describe('rules', () => {
  test('«Hjelperen kom ikke» opens on the morning of the job day, not before', () => {
    const fri14 = new Date(2026, 9, 30, 14, 0).toISOString();
    expect(noShowWindowOpen({ scheduledAt: fri14 }, new Date(2026, 9, 29, 23, 59).getTime())).toBe(false);
    expect(noShowWindowOpen({ scheduledAt: fri14 }, new Date(2026, 9, 30, 0, 1).getTime())).toBe(true);
    // an avtale without a set time can always be reported
    expect(noShowWindowOpen({}, 0)).toBe(true);
  });

  test('only the owner of an open avtale may report the helper', () => {
    const a = { scheduledAt: inHours(-1) };
    expect(canReportNoShow({ status: 'ACCEPTED', toProfileId: ME }, a, ME, false)).toBe(true);
    expect(canReportNoShow({ status: 'ACCEPTED', toProfileId: 'u-other' }, a, ME, false)).toBe(false);
    expect(canReportNoShow({ status: 'ACCEPTED', toProfileId: ME }, { ...a, cancelledAt: inHours(-1) }, ME, false)).toBe(false);
    expect(canReportNoShow({ status: 'ACCEPTED', toProfileId: ME }, a, ME, true)).toBe(false);
  });

  test('a report counts nothing for 48 hours, half once explained, fully with no answer', () => {
    const base = { weight: 1, countsAt: inHours(10) };
    expect(weightNow({ ...base, status: 'PENDING' })).toBe(0);
    expect(weightNow({ ...base, status: 'DISPUTED' })).toBe(0.5);
    expect(weightNow({ ...base, status: 'PENDING', countsAt: inHours(-1) })).toBe(1);
    expect(weightNow({ ...base, status: 'DISMISSED' })).toBe(0);
    // «Kom for sent» is mild
    expect(weightNow({ weight: 0.5, status: 'COUNTED', countsAt: inHours(-1) })).toBe(0.5);
  });
});

// ------------------------------------------------------------
// The owner's rescue
// ------------------------------------------------------------
describe('owner: «Hjelperen kom ikke»', () => {
  test('on the job day: report, cancel, haste, and the other tilbud come straight back with «Godta»', async () => {
    acceptAndreas(laterToday());
    await renderWithProviders(<AvtaleSammendragScreen proposalId="p-gjerde-andreas" />);
    expect(await screen.findByText('Kom ikke hjelperen?')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Hjelperen kom ikke' }));
    expect(await screen.findByText('Hva skjedde?')).toBeTruthy();
    // nothing happens before a reason is chosen
    expect(screen.queryByText('Avlys og finn en ny')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: /^Kom ikke\./ }));
    expect(screen.getByText('Dette skjer nå')).toBeTruthy();
    expect(screen.getByText('Oppdraget åpnes igjen, og de 2 som ga tilbud får spørsmål om de kan i dag')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Gjør det til hasteoppdrag' }).props.accessibilityState.checked).toBe(true);

    await fireEvent.press(screen.getByText('Avlys og finn en ny'));
    await waitFor(() => expect(chatRepository.getAgreement('p-gjerde-andreas')?.cancelledAt).toBeTruthy());
    expect(chatRepository.getAgreement('p-gjerde-andreas')?.cancelReason).toBe('Hjelperen kom ikke');
    // the report waits 48 hours for Andreas' side
    expect(noShowStore.list()).toEqual([expect.objectContaining({ proposalId: 'p-gjerde-andreas', reason: 'NO_SHOW', status: 'PENDING', weight: 1 })]);
    // the oppdrag is open again, as a hasteoppdrag for today
    const l = repositories.listings.get('l-male-gjerdet')!;
    expect(isUrgent(l)).toBe(true);
    // Emma and Martin were asked «Gjelder tilbudet ditt fortsatt?»
    expect(chatRepository.getProposal('p-gjerde-emma')?.rescueFrom).toBe('p-gjerde-andreas');
    expect(chatRepository.getProposal('p-gjerde-martin')?.rescueFrom).toBe('p-gjerde-andreas');

    // «Velg en annen nabo»
    expect(await screen.findByText('Velg en annen nabo')).toBeTruthy();
    expect(await screen.findByTestId('rescue-offer-p-gjerde-emma')).toBeTruthy();
    expect(screen.getByTestId('rescue-offer-p-gjerde-martin')).toBeTruthy();
    expect(screen.getByText('Hasteoppdrag i dag')).toBeTruthy();
  });

  test('whoever answered «Kan i dag» is shown first, and «Godta» makes the new avtale', async () => {
    acceptAndreas(laterToday());
    await apiClient.reportHelperNoShow('p-gjerde-andreas', 'NO_REPLY', false);
    chatRepository.patchProposal('p-gjerde-martin', { availableTodayAt: new Date().toISOString() });

    await renderWithProviders(<AvtaleSammendragScreen proposalId="p-gjerde-andreas" />);
    const martin = await screen.findByTestId('rescue-offer-p-gjerde-martin');
    const rows = screen.getAllByTestId(/^rescue-offer-/);
    expect(rows[0]).toBe(martin);
    expect(screen.getByText('Kan i dag')).toBeTruthy();
    // not made urgent this time: the button is there instead
    expect(screen.getByRole('button', { name: 'Gjør det til hasteoppdrag' })).toBeTruthy();

    await fireEvent.press(await screen.findByRole('button', { name: /^Godta Martin/ }));
    // the dialog: «Godta tilbudet fra Martin?» with the price and the payment note
    expect(await screen.findByText('Godta tilbudet fra Martin?')).toBeTruthy();
    const confirmBtn = screen.getAllByRole('button', { name: 'Godta' }).slice(-1)[0];
    await fireEvent.press(confirmBtn);
    await waitFor(() => expect(chatRepository.getProposal('p-gjerde-martin')?.status).toBe('ACCEPTED'));
  });

  test('not before the job day, and never for the helper', async () => {
    acceptAndreas(inHours(72));
    await renderWithProviders(<AvtaleSammendragScreen proposalId="p-gjerde-andreas" />);
    await screen.findByText('Avtalen er klar');
    expect(screen.queryByText('Kom ikke hjelperen?')).toBeNull();
    await expect(apiClient.reportHelperNoShow('p-gjerde-andreas', 'NO_SHOW', true)).rejects.toThrow('Du kan melde fra fra morgenen på jobbdagen.');
  });
});

// ------------------------------------------------------------
// The helper's job day
// ------------------------------------------------------------
describe('helper: «Bekreft at du kommer», på vei, framme', () => {
  /** Me as the helper on Martin's «Hjelp med flytting», later today. */
  const meAsHelper = () => {
    chatRepository.patchProposal('p-martin-flytting', { fromProfileId: ME, toProfileId: 'u-martin' });
    chatRepository.patchAgreement('p-martin-flytting', { scheduledAt: laterToday(), cancelledAt: undefined });
  };

  test('confirm, then «Jeg er på vei», then «Jeg er framme» – each one a step the owner sees', async () => {
    meAsHelper();
    await renderWithProviders(<AvtaleSammendragScreen proposalId="p-martin-flytting" />);
    expect(await screen.findByText('Bekreft at du kommer')).toBeTruthy();
    // the helper never sees «Hjelperen kom ikke»
    expect(screen.queryByText('Kom ikke hjelperen?')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Jeg kommer' }));
    await waitFor(() => expect(chatRepository.getAgreement('p-martin-flytting')?.helperConfirmedAt).toBeTruthy());
    await fireEvent.press(await screen.findByRole('button', { name: 'Jeg er på vei' }));
    await waitFor(() => expect(chatRepository.getAgreement('p-martin-flytting')?.helperStatus).toBe('ON_THE_WAY'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Jeg er framme' }));
    // a sheet asks whether to share roughly where you are (off by default); its button sends
    expect(await screen.findByText('Si fra at du er framme')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Jeg er framme' }).at(-1)!);
    await waitFor(() => expect(chatRepository.getAgreement('p-martin-flytting')?.helperStatus).toBe('ARRIVED'));
    expect(chatRepository.getAgreement('p-martin-flytting')?.helperStatusPlace).toBeUndefined();
  });

  test('«Jeg kommer» on the push confirms when the avtale opens', async () => {
    meAsHelper();
    await renderWithProviders(<AvtaleSammendragScreen proposalId="p-martin-flytting" answerYes />);
    await waitFor(() => expect(chatRepository.getAgreement('p-martin-flytting')?.helperConfirmedAt).toBeTruthy());
  });

  test('cancelling within 24 hours counts half and asks the others again', async () => {
    meAsHelper();
    await apiClient.cancelAgreement('p-martin-flytting', 'Syk');
    expect(noShowStore.list()).toEqual([expect.objectContaining({ reason: 'HELPER_CANCELLED', weight: 0.5, status: 'COUNTED', explanation: 'Syk' })]);
  });
});

// ------------------------------------------------------------
// The other tilbud: «Ja, jeg kan i dag»
// ------------------------------------------------------------
describe('another sender: «Oppdraget er ledig igjen»', () => {
  const meAsEmma = () => {
    repositories.listings.setStatus('l-male-gjerdet', 'RECEIVING_OFFERS');
    chatRepository.patchProposal('p-gjerde-emma', { fromProfileId: ME, toProfileId: 'u-emma-owner', rescueFrom: 'p-gjerde-andreas' });
  };

  test('one tap says the tilbud stands today', async () => {
    meAsEmma();
    await renderWithProviders(<TilbudDetaljScreen proposalId="p-gjerde-emma" />);
    expect(await screen.findByText('Oppdraget er ledig igjen')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ja, jeg kan i dag' }));
    await waitFor(() => expect(chatRepository.getProposal('p-gjerde-emma')?.availableTodayAt).toBeTruthy());
    expect(await screen.findByText('Du har sagt ja')).toBeTruthy();
  });

  test('the same tap from the push needs no second tap', async () => {
    meAsEmma();
    await renderWithProviders(<TilbudDetaljScreen proposalId="p-gjerde-emma" answerYes />);
    await waitFor(() => expect(chatRepository.getProposal('p-gjerde-emma')?.availableTodayAt).toBeTruthy());
  });
});

// ------------------------------------------------------------
// Fairness: explain, and the pause
// ------------------------------------------------------------
describe('the helper explains', () => {
  const report = (patch = {}) =>
    noShowStore.add({
      id: 'ns-1', proposalId: 'p-gjerde-andreas', reason: 'NO_SHOW', status: 'PENDING', weight: 1,
      countsAt: inHours(40), createdAt: new Date().toISOString(), reporterName: 'Kari', reportedName: 'Andreas',
      iAmReported: true, listingTitle: 'Male gjerdet', ...patch,
    });

  test('within 48 hours an explanation makes it count half', async () => {
    report();
    await renderWithProviders(<UteblittScreen reportId="ns-1" />);
    expect(await screen.findByText('Kom ikke')).toBeTruthy();
    expect(screen.getByText('Teller om 40 timer hvis du ikke svarer')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Forklar hva som skjedde'), 'Syk');
    await fireEvent.press(screen.getByText('Send forklaring'));
    expect(await screen.findByText('Skriv litt mer om hva som skjedde.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Forklar hva som skjedde'), 'Jeg ble syk og fikk ikke sagt fra i tide.');
    await fireEvent.press(screen.getByText('Send forklaring'));
    await waitFor(() => expect(noShowStore.get('ns-1')?.status).toBe('DISPUTED'));
    expect(await screen.findByText('Teller halvt')).toBeTruthy();
  });

  test('after 48 hours it can no longer be explained', async () => {
    report({ countsAt: inHours(-1) });
    await renderWithProviders(<UteblittScreen reportId="ns-1" />);
    expect(await screen.findByText('Teller fullt')).toBeTruthy();
    expect(screen.queryByLabelText('Forklar hva som skjedde')).toBeNull();
    await expect(apiClient.explainNoShow('ns-1', 'Jeg ble syk og fikk ikke sagt fra.')).rejects.toThrow('Fristen på 48 timer er ute.');
  });
});

test('two no-shows in 90 days: no new tilbud until the pause is over', async () => {
  noShowStore.setPause(inHours(24 * 10));
  expect(await apiClient.getMyTilbudPause()).toBeTruthy();
  await expect(
    apiClient.sendProposal({ listingId: 'l-male-gjerdet', conversationId: 'c-x', fromProfileId: ME, toProfileId: 'u-x', price: { amountMinor: 50000, currency: 'NOK' } } as never),
  ).rejects.toThrow(/Du kan gi tilbud igjen/);
});
