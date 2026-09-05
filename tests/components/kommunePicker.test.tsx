import { render, screen, fireEvent } from '@testing-library/react-native';
import { KommunePicker } from '@/components/KommunePicker';
import { INNLANDET_KOMMUNER } from '@/data/kommuner';

describe('KommunePicker', () => {
  it('filters the list and emits the chosen kommune', async () => {
    const onChange = jest.fn();
    await render(<KommunePicker value="" onChange={onChange} />);
    // full list before filtering
    expect(screen.queryByText('Lillehammer')).toBeTruthy();

    await fireEvent.changeText(
      screen.getByPlaceholderText(/Søk etter kommune/i),
      'gjøv',
    );
    // filter narrowed the list — the non-matching kommuner are gone
    expect(screen.queryByText('Lillehammer')).toBeNull();
    await fireEvent.press(screen.getByText('Gjøvik'));
    expect(onChange).toHaveBeenCalledWith('Gjøvik');
  });

  it('resolves a postal code to a kommune via the hint row', async () => {
    const onChange = jest.fn();
    await render(<KommunePicker value="" onChange={onChange} />);
    await fireEvent.changeText(
      screen.getByPlaceholderText(/Søk etter kommune/i),
      '2380',
    );
    // 2380 -> Brumunddal -> Ringsaker
    await fireEvent.press(screen.getByTestId('kommune-postal-hint'));
    expect(onChange).toHaveBeenCalledWith('Ringsaker');
  });

  it('shows every kommune when the query is empty', async () => {
    await render(<KommunePicker value="" onChange={jest.fn()} />);
    for (const k of INNLANDET_KOMMUNER) {
      expect(screen.getByText(k)).toBeTruthy();
    }
  });
});
