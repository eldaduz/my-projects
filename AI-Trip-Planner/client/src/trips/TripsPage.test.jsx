import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TripsPage } from './TripsPage';

function jsonResponse(status, body) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

function renderTripsPage() {
  return render(
    <MemoryRouter initialEntries={['/trips']}>
      <Routes>
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/trips/:id" element={<p>Wizard for trip</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TripsPage', () => {
  let trips;
  let pendingDelete;
  let resolveDelete;

  beforeEach(() => {
    trips = [{ id: '1', destination: 'Lisbon', status: 'DRAFT' }];
    pendingDelete = false;
    resolveDelete = null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const method = options.method || 'GET';

        if (url === '/api/trips' && method === 'GET') {
          return jsonResponse(200, { trips });
        }

        if (url === '/api/trips' && method === 'POST') {
          const created = { id: '2', status: 'DRAFT', wizardStep: 1 };
          trips = [created, ...trips];
          return jsonResponse(201, { trip: created });
        }

        if (url === '/api/trips/1' && method === 'DELETE') {
          if (pendingDelete) {
            return new Promise((resolve) => {
              resolveDelete = () => {
                trips = trips.filter((trip) => trip.id !== '1');
                resolve(jsonResponse(204));
              };
            });
          }
          trips = trips.filter((trip) => trip.id !== '1');
          return jsonResponse(204);
        }

        if (url.startsWith('/api/enrichment/photo') && method === 'GET') {
          return jsonResponse(200, {
            available: true,
            url: 'https://example.com/photo.jpg',
            attribution: 'Example',
          });
        }

        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('lists existing trips', async () => {
    renderTripsPage();

    await waitFor(() => expect(screen.getByText(/Lisbon/)).toBeInTheDocument());
  });

  test('shows a destination photo thumbnail on each trip card', async () => {
    const { container } = renderTripsPage();

    await waitFor(() => expect(screen.getByText(/Lisbon/)).toBeInTheDocument());
    await waitFor(() =>
      expect(container.querySelector('.destination-photo img')).toHaveAttribute(
        'src',
        'https://example.com/photo.jpg',
      ),
    );
  });

  test('starts a new trip and navigates to its wizard', async () => {
    const user = userEvent.setup();
    renderTripsPage();
    await waitFor(() => expect(screen.getByText(/Lisbon/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /start a new trip/i }));

    await waitFor(() => expect(screen.getByText('Wizard for trip')).toBeInTheDocument());
  });

  test('deletes a listed trip after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTripsPage();
    await waitFor(() => expect(screen.getByText(/Lisbon/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete lisbon/i }));

    await waitFor(() => expect(screen.queryByText(/Lisbon/)).not.toBeInTheDocument());
  });

  test('offers deletion only for draft and planned trips', async () => {
    trips = [
      { id: '1', destination: 'Lisbon', status: 'DRAFT' },
      { id: '2', destination: 'Rome', status: 'PLANNED' },
      { id: '3', destination: 'Paris', status: 'READY_FOR_GENERATION' },
      { id: '4', destination: 'Berlin', status: 'GENERATING' },
    ];
    renderTripsPage();

    await waitFor(() => expect(screen.getByText(/Paris/)).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /delete lisbon/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete rome/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete paris/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete berlin/i })).not.toBeInTheDocument();
  });

  test('prevents another delete while a trip deletion is pending', async () => {
    const user = userEvent.setup();
    trips = [
      { id: '1', destination: 'Lisbon', status: 'DRAFT' },
      { id: '2', destination: 'Rome', status: 'PLANNED' },
    ];
    pendingDelete = true;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTripsPage();
    await waitFor(() => expect(screen.getByText(/Rome/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete lisbon/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /delete rome/i })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: /open lisbon/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /open rome/i })).toBeDisabled();
    await act(async () => resolveDelete());
  });
});
