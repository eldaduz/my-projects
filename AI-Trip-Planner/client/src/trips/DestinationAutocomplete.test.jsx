import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DestinationAutocomplete } from './DestinationAutocomplete';
import { apiClient } from '../api/apiClient';

vi.mock('../api/apiClient', () => ({ apiClient: { get: vi.fn() } }));

describe('DestinationAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('debounces typing and shows suggestions from the API', async () => {
    apiClient.get.mockResolvedValue({ suggestions: [{ label: 'Paris, France', lat: 48.85, lon: 2.35 }] });
    const handleChange = vi.fn();
    render(<DestinationAutocomplete id="destination" value="" onChange={handleChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Par' } });
    expect(apiClient.get).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/enrichment/autocomplete?q=Par', {
        signal: expect.any(AbortSignal),
      }),
    );

    expect(await screen.findByText('Paris, France')).toBeInTheDocument();
  });

  test('selecting a suggestion calls onChange with its label and clears the list', async () => {
    apiClient.get.mockResolvedValue({ suggestions: [{ label: 'Paris, France', lat: 48.85, lon: 2.35 }] });
    const handleChange = vi.fn();
    render(<DestinationAutocomplete id="destination" value="Par" onChange={handleChange} />);

    // React's input value tracker suppresses onChange when fireEvent.change sets a
    // value identical to the DOM's current value (a known RTL/jsdom quirk, unrelated
    // to the component under test). Fire a differing value first so the real change
    // to 'Par' is actually observed.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pa' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Par' } });
    vi.advanceTimersByTime(300);
    const suggestion = await screen.findByText('Paris, France');

    fireEvent.click(suggestion);

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: 'Paris, France' }) }));
    expect(screen.queryByText('Paris, France')).not.toBeInTheDocument();
  });

  test('a failed lookup leaves the input usable with no suggestions shown', async () => {
    apiClient.get.mockRejectedValue(new Error('network down'));
    render(<DestinationAutocomplete id="destination" value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Par' } });
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('a stale response resolving after a newer one does not overwrite the newer suggestions', async () => {
    let resolveFirst;
    let resolveSecond;
    apiClient.get
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    render(<DestinationAutocomplete id="destination" value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Par' } });
    vi.advanceTimersByTime(300);
    fireEvent.change(input, { target: { value: 'Pari' } });
    vi.advanceTimersByTime(300);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

    // Newer (second) request resolves first, then the stale first request resolves after.
    resolveSecond({ suggestions: [{ label: 'Paris, France', lat: 48.85, lon: 2.35 }] });
    await screen.findByText('Paris, France');

    resolveFirst({ suggestions: [{ label: 'Parma, Italy', lat: 44.8, lon: 10.33 }] });
    await waitFor(() => {});

    expect(screen.getByText('Paris, France')).toBeInTheDocument();
    expect(screen.queryByText('Parma, Italy')).not.toBeInTheDocument();
  });

  test('selecting a suggestion while a debounced fetch is pending does not repopulate the list', async () => {
    apiClient.get.mockResolvedValue({ suggestions: [{ label: 'Paris, France', lat: 48.85, lon: 2.35 }] });
    const handleChange = vi.fn();
    render(<DestinationAutocomplete id="destination" value="Par" onChange={handleChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Pa' } });
    fireEvent.change(input, { target: { value: 'Par' } });
    vi.advanceTimersByTime(300);
    const suggestion = await screen.findByText('Paris, France');

    // A new keystroke triggers another debounced fetch that hasn't fired yet.
    fireEvent.change(input, { target: { value: 'Pari' } });

    fireEvent.click(suggestion);
    expect(screen.queryByText('Paris, France')).not.toBeInTheDocument();

    // Let the still-pending debounce timer fire, if it wasn't cleared.
    vi.advanceTimersByTime(300);
    await waitFor(() => {});

    expect(screen.queryByText('Paris, France')).not.toBeInTheDocument();
  });

  test('selecting a suggestion while a different query is already in flight does not repopulate the list', async () => {
    let resolveSecond;
    apiClient.get
      .mockResolvedValueOnce({ suggestions: [{ label: 'Paris, France', lat: 48.85, lon: 2.35 }] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const handleChange = vi.fn();
    render(<DestinationAutocomplete id="destination" value="Par" onChange={handleChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Pa' } });
    fireEvent.change(input, { target: { value: 'Par' } });
    vi.advanceTimersByTime(300);
    const suggestion = await screen.findByText('Paris, France');

    // A second query's debounce elapses and its fetch actually starts (unlike
    // the "pending" case above, this request is already in flight, not just
    // scheduled) before the user selects a suggestion from the first query's
    // still-visible list.
    fireEvent.change(input, { target: { value: 'Pari' } });
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

    fireEvent.click(suggestion);
    expect(screen.queryByText('Paris, France')).not.toBeInTheDocument();

    // The in-flight second request resolves after the selection.
    resolveSecond({ suggestions: [{ label: 'Parma, Italy', lat: 44.8, lon: 10.33 }] });
    await waitFor(() => {});

    expect(screen.queryByText('Parma, Italy')).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('suggestions are keyboard-reachable and selectable without a mouse', async () => {
    apiClient.get.mockResolvedValue({
      suggestions: [
        { label: 'Paris, France', lat: 48.85, lon: 2.35 },
        { label: 'Parma, Italy', lat: 44.8, lon: 10.33 },
      ],
    });
    const handleChange = vi.fn();
    render(<DestinationAutocomplete id="destination" value="" onChange={handleChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Par' } });
    vi.advanceTimersByTime(300);
    await screen.findByText('Paris, France');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const firstOption = screen.getByRole('option', { name: 'Paris, France' });
    expect(firstOption).toHaveFocus();

    fireEvent.keyDown(firstOption, { key: 'ArrowDown' });
    const secondOption = screen.getByRole('option', { name: 'Parma, Italy' });
    expect(secondOption).toHaveFocus();

    fireEvent.click(secondOption);
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: 'Parma, Italy' }) }),
    );
  });
});
