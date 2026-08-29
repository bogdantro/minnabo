import { useState } from 'react';
import { screen, fireEvent } from '@testing-library/react-native';
import { TimeField } from '@/components/ui/TimeField';
import { renderWithProviders } from '../testUtils';

const render = renderWithProviders;

function Harness({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return <TimeField label="Tid" value={value} onChange={setValue} />;
}

test('TimeField picks an hour + minute on the wheels and confirms', async () => {
  await render(<Harness />);

  await fireEvent.press(screen.getByLabelText('Tid'));
  await fireEvent.press(screen.getByLabelText('Time: 14'));
  await fireEvent.press(screen.getByLabelText('Minutt: 30'));
  await fireEvent.press(screen.getByText('Velg 14:30'));

  expect(screen.getByLabelText('Tid').props.accessibilityValue).toEqual({ text: '14:30' });
});

test('TimeField preselects the current value when reopened', async () => {
  await render(<Harness initial="18:15" />);
  await fireEvent.press(screen.getByLabelText('Tid'));

  expect(screen.getByText('Velg 18:15')).toBeTruthy();
  expect(screen.getByLabelText('Time: 18').props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByLabelText('Minutt: 15').props.accessibilityState).toMatchObject({ selected: true });
});

test('TimeField snaps an off-step minute to the nearest 5', async () => {
  await render(<Harness initial="09:13" />);
  await fireEvent.press(screen.getByLabelText('Tid'));
  expect(screen.getByText('Velg 09:15')).toBeTruthy();
});
