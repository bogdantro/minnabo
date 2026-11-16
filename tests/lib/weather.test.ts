import { fetchOutdoorWarning, warningFromForecast } from '@/lib/weather';

const day = new Date(2026, 10, 14); // a Saturday
const at = (hour: number, mm: number, temp = 6, wind = 3) => ({
  time: new Date(2026, 10, 14, hour).toISOString(),
  data: { instant: { details: { air_temperature: temp, wind_speed: wind } }, next_1_hours: { details: { precipitation_amount: mm } } },
});

test('rain in the working hours gives a rain warning', () => {
  expect(warningFromForecast([at(9, 1), at(11, 1.5), at(14, 1)], day)).toEqual({ kind: 'RAIN' });
});

test('the same amount below freezing is snow', () => {
  expect(warningFromForecast([at(9, 2, -2), at(12, 2, -1)], day)).toEqual({ kind: 'SNOW' });
});

test('strong wind alone gives a wind warning', () => {
  expect(warningFromForecast([at(10, 0, 8, 12)], day)).toEqual({ kind: 'WIND' });
});

test('rain at night does not count', () => {
  expect(warningFromForecast([at(2, 10), at(22, 10)], day)).toBeNull();
});

test('a little drizzle is not worth a word', () => {
  expect(warningFromForecast([at(10, 0.5), at(13, 0.5)], day)).toBeNull();
});

test('no hourly steps for the day means no warning', () => {
  expect(warningFromForecast([], day)).toBeNull();
});

test('an indoor category never asks MET', async () => {
  const spy = jest.spyOn(global, 'fetch' as never);
  await expect(fetchOutdoorWarning('data', new Date().toISOString(), 'Lillehammer')).resolves.toBeNull();
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
