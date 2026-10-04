import { screen, fireEvent } from '@testing-library/react-native';
import { VilkarScreen } from '@/screens/VilkarScreen';
import { TERMS_SECTIONS } from '@/content/terms';
import { renderWithProviders } from '../testUtils';

test('Vilkår lists all sections with "Kort fortalt", TOC chips and the accepted date', async () => {
  await renderWithProviders(<VilkarScreen />);
  expect(screen.getByText('Det viktigste på 20 sekunder')).toBeTruthy();
  for (const s of TERMS_SECTIONS) expect(screen.getAllByText(s.title).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Kort fortalt')).toHaveLength(TERMS_SECTIONS.length);
  expect(screen.getByText(/Du må være minst 15 år/)).toBeTruthy();
  // no unfilled placeholders reach the user
  expect(screen.queryByText(/\[e-postadresse\]|\[aldersgrense\]|\[antall\]/)).toBeNull();
  expect(await screen.findByText('15. januar 2026')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('5. Betaling'));
});
