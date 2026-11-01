import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/api/client';
import { rememberInviter, sendPendingInvite } from '@/lib/invite';
import { profileRepository } from '@mocks/data/profileRepository';

const INVITER = '11111111-2222-4333-8444-555555555555';

beforeEach(() => AsyncStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('the inviter from the link is sent once after Oppsett, then forgotten', async () => {
  const spy = jest.spyOn(apiClient, 'recordInvite').mockResolvedValue(true);
  await rememberInviter(INVITER);
  await sendPendingInvite();
  expect(spy).toHaveBeenCalledWith(INVITER);
  await sendPendingInvite();
  expect(spy).toHaveBeenCalledTimes(1);
});

test('a link without a real id stores nothing', async () => {
  const spy = jest.spyOn(apiClient, 'recordInvite');
  await rememberInviter('not-an-id');
  await rememberInviter(undefined);
  await sendPendingInvite();
  expect(spy).not.toHaveBeenCalled();
});

test('offline: kept for the next try, onboarding is never stopped', async () => {
  jest.spyOn(apiClient, 'recordInvite').mockRejectedValueOnce(new Error('Network request failed'));
  await rememberInviter(INVITER);
  await expect(sendPendingInvite()).resolves.toBeUndefined();
  expect(await AsyncStorage.getItem('minnabo.invite.ref')).toBe(INVITER);
});

test('the mock follows 0081: not yourself, first answer counts, and it is counted', async () => {
  const me = profileRepository.currentUserId;
  expect(await apiClient.recordInvite(me)).toBe(false);
  expect(await apiClient.recordInvite('u-emma')).toBe(true);
  expect(await apiClient.recordInvite('u-martin')).toBe(false);
  expect(await apiClient.inviteCount('u-emma')).toBe(1);
});
