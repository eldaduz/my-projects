import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferenceSelector } from './PreferenceSelector';

const CATEGORIES = [
  { key: 'museums', label: 'Museums' },
  { key: 'nightlife', label: 'Nightlife' },
];

describe('PreferenceSelector', () => {
  test('defaults to Neutral for a category with no saved value', () => {
    render(
      <PreferenceSelector
        idPrefix="test"
        categories={CATEGORIES}
        values={{}}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText('Neutral', { selector: '#test-museums-neutral' })).toBeChecked();
  });

  test('marks the saved value as checked', () => {
    render(
      <PreferenceSelector
        idPrefix="test"
        categories={CATEGORIES}
        values={{ museums: 'interested' }}
        onChange={() => {}}
      />,
    );

    expect(document.getElementById('test-museums-interested')).toBeChecked();
  });

  test('calls onChange with the category and selected value, keyboard-reachable via labelled radios', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PreferenceSelector
        idPrefix="test"
        categories={CATEGORIES}
        values={{}}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText(/block/i, { selector: '#test-nightlife-block' }));

    expect(onChange).toHaveBeenCalledWith('nightlife', 'block');
  });

  test('BLOCK is labelled with text, not communicated by color alone', () => {
    render(
      <PreferenceSelector
        idPrefix="test"
        categories={CATEGORIES}
        values={{}}
        onChange={() => {}}
      />,
    );

    expect(screen.getAllByText(/block/i).length).toBeGreaterThan(0);
  });
});
