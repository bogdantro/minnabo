import { useState } from 'react';
import { screen, fireEvent } from '@testing-library/react-native';
import { TimeField } from '@/components/ui/TimeField';
import { renderWithProviders } from '../testUtils';

const render = renderWithProviders;

function Harness({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return <TimeField label="Tid" value={value} onChange={setValue} />;
}

test('TimeField picks an hour + minute from the grid and confirms', async () => {
  await render(<Harness />);

  await fireEvent.press(screen.getByLabelText('Tid'));
  await fireEvent.press(screen.getByLabelText('Klokken 14'));
  await fireEvent.press(screen.getByLabelText('30 minutter'));
  await fireEvent.press(screen.getByText('Velg 14:30'));

  // The closed field now shows the chosen time.
  expect(screen.getByLabelText('Tid').props.accessibilityValue).toEqual({ text: '14:30' });
});

test('TimeField preselects the current value when reopened', async () => {
  await render(<Harness initial="18:00" />);
  await fireEvent.press(screen.getByLabelText('Tid'));
  expect(screen.getByText('Velg 18:00')).toBeTruthy();
  expect(screen.getByLabelText('Klokken 18').props.accessibilityState).toMatchObject({
    selected: true,
  });
});

test('TimeField quick preset sets the time in one tap', async () => {
  await render(<Harness />);
  await fireEvent.press(screen.getByLabelText('Tid'));
  await fireEvent.press(screen.getByLabelText('Klokken 12:00'));
  await fireEvent.press(screen.getByText('Velg 12:00'));
  expect(screen.getByLabelText('Tid').props.accessibilityValue).toEqual({ text: '12:00' });
});
