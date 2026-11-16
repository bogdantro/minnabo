/** «Lån ut» on Oppslagstavla and Utlån are one thing (0107): one form, one loan, and each shows up in the other. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { extras } from '@mocks/mockClient';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { NoticeboardScreen } from '@/screens/NoticeboardScreen';
import { LendScreen } from '@/screens/LendScreen';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  extras.reset();
  noticeboardStore._reset();
});

const board = async () => (await apiClient.listNoticeboard()).filter((p) => p.kind === 'TOOL_LEND');
const lendItems = async () => apiClient.listLendItems({ municipality: 'Lillehammer' });

describe('the link', () => {
  test('a thing added on Utlån is a «Lån ut» oppslag, and edits, hiding and deleting follow', async () => {
    const it = await apiClient.saveLendItem({ title: 'Tilhenger', category: 'TRANSPORT', note: 'Vanlig 750 kg' });
    let post = (await board()).find((p) => p.title === 'Tilhenger');
    expect(post).toMatchObject({ body: 'Vanlig 750 kg', lendItemId: it.id, municipality: 'Lillehammer' });

    await apiClient.saveLendItem({ id: it.id, title: 'Tilhenger 750 kg', category: 'TRANSPORT', active: false });
    post = (await board()).find((p) => p.lendItemId === it.id);
    expect(post?.title).toBe('Tilhenger 750 kg');
    expect(post?.doneAt).toBeTruthy();

    await apiClient.deleteLendItem(it.id);
    expect((await board()).some((p) => p.lendItemId === it.id)).toBe(false);
  });

  test('a «Lån ut» oppslag is a thing on Utlån, and board edits, «Avsluttet» and deleting follow', async () => {
    const post = await apiClient.createNoticeboardPost({ kind: 'TOOL_LEND', title: 'Låner ut snøfreser', body: 'Honda, går fint', place: 'Sentrum', municipality: 'Lillehammer' });
    let item = (await lendItems()).find((i) => i.noticeId === post.id);
    expect(item).toMatchObject({ title: 'Låner ut snøfreser', note: 'Honda, går fint', active: true });

    await apiClient.updateNoticeboardPost(post.id, { title: 'Låner ut snøfreser (Honda)', done: true });
    item = (await apiClient.listLendItems({ ownerId: item!.ownerId })).find((i) => i.noticeId === post.id);
    expect(item).toMatchObject({ title: 'Låner ut snøfreser (Honda)', active: false });

    await apiClient.deleteNoticeboardPost(post.id);
    expect((await apiClient.listLendItems({ ownerId: item!.ownerId })).some((i) => i.noticeId === post.id)).toBe(false);
  });

  test('an oppslag changed to another kind leaves Utlån', async () => {
    const post = await apiClient.createNoticeboardPost({ kind: 'TOOL_LEND', title: 'Låner ut stige', body: 'Tre meter lang', place: 'Sentrum', municipality: 'Lillehammer' });
    await apiClient.updateNoticeboardPost(post.id, { kind: 'GENERAL' });
    expect((await lendItems()).some((i) => i.title === 'Låner ut stige')).toBe(false);
  });

  test('a youth can lend out, and it shows on the board', async () => {
    extras.guardian = { ...extras.guardian, youth: true };
    const it = await apiClient.saveLendItem({ title: 'Fotballmål', category: 'FRITID' });
    expect((await board()).some((p) => p.lendItemId === it.id)).toBe(true);
  });
});

describe('the screens', () => {
  test('«Lån ut» on the board opens the Utlån form, and what it saves is on both', async () => {
    await renderWithProviders(<NoticeboardScreen />);
    await fireEvent.press((await screen.findAllByLabelText('Lån ut'))[0]);
    expect(await screen.findByText('Lån ut noe')).toBeTruthy();
    expect(screen.getByText('Hva slags ting?')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Hva er det?'), 'Partytelt 3x6');
    await fireEvent.press(screen.getByText('Legg ut'));
    await waitFor(async () => expect((await lendItems()).some((i) => i.title === 'Partytelt 3x6')).toBe(true));
    expect((await board()).some((p) => p.title === 'Partytelt 3x6')).toBe(true);
  });

  test('picking «Lån ut» while writing an oppslag moves to the same form with the title kept', async () => {
    await renderWithProviders(<NoticeboardScreen />);
    await fireEvent.press((await screen.findAllByLabelText('Nytt oppslag'))[0]);
    await fireEvent.changeText(await screen.findByLabelText('Tittel'), 'Slagbormaskin');
    await fireEvent.press(screen.getByRole('radio', { name: 'Lån ut' }));
    expect(await screen.findByText('Lån ut noe')).toBeTruthy();
    expect(screen.getByDisplayValue('Slagbormaskin')).toBeTruthy();
  });

  test('a «Lån ut» oppslag on the board borrows through the same popup as Utlån', async () => {
    await apiClient.saveLendItem({ title: 'Høytrykksspyler', category: 'HAGE' });
    // someone else's thing: move it to Emma
    const it = (await lendItems()).find((i) => i.title === 'Høytrykksspyler')!;
    extras.lendItems = extras.lendItems.map((i) => (i.id === it.id ? { ...i, ownerId: 'u-emma' } : i));
    noticeboardStore._patch(it.noticeId!, { authorProfileId: 'u-emma' });

    await renderWithProviders(<NoticeboardScreen />);
    expect(await screen.findByText('Ledig i dag')).toBeTruthy();
    await fireEvent.press(screen.getByText('Spør om lån'));
    // the Utlån popup: its 14 days, then the ask
    expect(await screen.findByText('De neste 14 dagene')).toBeTruthy();
    const ask = screen.getAllByText('Spør om lån');
    await fireEvent.press(ask[ask.length - 1]);
    await fireEvent.press(await screen.findByText('I morgen'));
    await fireEvent.press(screen.getByText('Send forespørsel'));
    expect(await screen.findByText('Forespørselen er sendt')).toBeTruthy();
    expect(extras.lendRequests[0]).toMatchObject({ itemId: it.id, status: 'PENDING' });
  });

  test('a thing added on Utlån appears on the board', async () => {
    await renderWithProviders(<LendScreen />);
    await fireEvent.press((await screen.findAllByLabelText('Legg til noe du kan låne ut'))[0]);
    await fireEvent.changeText(await screen.findByLabelText('Hva er det?'), 'Vaffeljern');
    await fireEvent.press(screen.getByText('Legg ut'));
    await waitFor(async () => expect((await board()).some((p) => p.title === 'Vaffeljern')).toBe(true));
  });
});
