import { screen } from '@testing-library/react-native';
import { EmptyScene } from '@/components/ui/EmptyScene';
import { renderWithProviders } from '../testUtils';

test('the drawing is decoration only – screen readers skip it', async () => {
  await renderWithProviders(<EmptyScene icon="bell" tone="cyan" />);
  const scene = screen.getByTestId('empty-scene', { includeHiddenElements: true });
  expect(scene.props.accessibilityElementsHidden).toBe(true);
});
