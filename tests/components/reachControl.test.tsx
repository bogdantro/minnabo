import { render, screen, fireEvent } from '@testing-library/react-native';
import { ReachControl } from '@/components/ReachControl';
import nb from '@/i18n/nb';

describe('ReachControl', () => {
  it('renders the label and all three reach options', async () => {
    await render(<ReachControl value={0} onChange={jest.fn()} />);
    expect(screen.getByText(nb.location.reachLabel)).toBeTruthy();
    expect(screen.getByText(nb.location.reachOwn)).toBeTruthy();
    expect(screen.getByText(nb.location.reachNeighbours)).toBeTruthy();
    expect(screen.getByText(nb.location.reachRegion)).toBeTruthy();
  });

  it('reports the picked reach', async () => {
    const onChange = jest.fn();
    await render(<ReachControl value={0} onChange={onChange} />);
    await fireEvent.press(screen.getByText(nb.location.reachNeighbours));
    expect(onChange).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByText(nb.location.reachRegion));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('marks the active option as selected for accessibility', async () => {
    await render(<ReachControl value={2} onChange={jest.fn()} />);
    const active = screen.getByRole('button', { name: nb.location.reachRegion });
    expect(active.props.accessibilityState).toEqual({ selected: true });
  });
});
