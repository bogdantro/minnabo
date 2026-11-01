import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { CompletionScreen } from '@/screens/CompletionScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { jobWorkspaceStore } from '@mocks/data/jobWorkspaceStore';
import { profileRepository } from '@mocks/data/profileRepository';
import { profiles } from '@mocks/data/seed';
import { renderWithProviders } from '../testUtils';

const ID = 'p-martin-flytting';

beforeAll(() => {
  // the signed-in user is the helper on a job both sides have confirmed, with before/after photos
  const p = chatRepository.getProposal(ID)!;
  const owner = p.fromProfileId;
  p.fromProfileId = profiles.mb.id;
  p.toProfileId = owner;
  profileRepository.confirmCompletion(ID, profiles.mb.id);
  profileRepository.confirmCompletion(ID, owner);
  jobWorkspaceStore.addPhoto(ID, 'https://example.com/for.jpg', 'BEFORE');
  jobWorkspaceStore.addPhoto(ID, 'https://example.com/etter.jpg', 'AFTER');
});

test('the helper adds the before/after photos to the portfolio, and coming back never offers it twice', async () => {
  const first = await renderWithProviders(<CompletionScreen proposalId={ID} />);
  expect(await screen.findByText('Vis fram jobben')).toBeTruthy();
  expect(screen.getByLabelText('Før')).toBeTruthy();
  expect(screen.getByLabelText('Etter')).toBeTruthy();
  await fireEvent.press(screen.getByText('Legg til i porteføljen'));
  await waitFor(() => expect(screen.getByText('Lagt til i porteføljen')).toBeTruthy());
  expect(profileRepository.listPortfolio(profiles.mb.id).filter((x) => x.afterUrl === 'https://example.com/etter.jpg')).toHaveLength(1);
  first.unmount();

  await renderWithProviders(<CompletionScreen proposalId={ID} />);
  expect(await screen.findByText('Lagt til i porteføljen')).toBeTruthy();
  expect(screen.queryByText('Legg til i porteføljen')).toBeNull();
});
