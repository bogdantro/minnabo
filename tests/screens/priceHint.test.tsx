import { screen } from '@testing-library/react-native';
import { PriceRangeHint, pricePosition } from '@/screens/LeggUt/PriceRangeHint';
import { renderWithProviders } from '../testUtils';

test('where an amount lands against the usual range', () => {
  expect(pricePosition(0, 300, 500)).toBe('none');
  expect(pricePosition(250, 300, 500)).toBe('low');
  expect(pricePosition(400, 300, 500)).toBe('within');
  expect(pricePosition(650, 300, 500)).toBe('high');
});

test('«Vanlig her» sits by the budget and says how the amount compares – only an indication', async () => {
  await renderWithProviders(<PriceRangeHint low={300} high={500} amount={650} fromArea />);
  expect(screen.getByText('Vanlig her: 300–500 kr')).toBeTruthy();
  expect(screen.getByText('Litt høyt')).toBeTruthy();
  expect(screen.getByText(/dere avtaler selv/)).toBeTruthy();
});
