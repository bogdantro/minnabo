import { _resetVippsLogin, completeVippsLogin } from '@/auth/vipps';

beforeEach(() => _resetVippsLogin());

// Vipps refuses people under 15 inside its own app and only sends back an error code,
// so the message must mention the age limit – «Innloggingen ble avbrutt.» told them nothing.
test('when Vipps sends back an error, the person learns about the age limit', async () => {
  await expect(completeVippsLogin({ error: 'access_denied' })).rejects.toThrow(/minst 15 år/);
  await expect(completeVippsLogin({ error: 'server_error' })).rejects.toThrow(/minst 15 år/);
});

test('coming back from Vipps without any code is still just a cancelled login', async () => {
  await expect(completeVippsLogin({})).rejects.toThrow('Innloggingen ble avbrutt.');
});
