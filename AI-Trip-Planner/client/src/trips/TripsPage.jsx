import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { EmptyState } from '../shared/EmptyState';
import { DestinationPhoto } from './DestinationPhoto';

export function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    apiClient
      .get('/trips', { signal: controller.signal })
      .then(({ trips }) => {
        if (!active) return;
        setTrips(trips);
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setLoadStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // A DRAFT trip is persisted immediately so its wizard progress survives
  // refresh/close (SYSTEM_DESIGN §4) — creation and navigation happen together.
  async function startNewTrip() {
    setStartError(null);
    setStarting(true);
    try {
      const { trip } = await apiClient.post('/trips', {});
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setStartError(err.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className="page page--wide">
      <div className="page-header">
        <h1>Your trips</h1>
        <button type="button" className="btn btn-primary" onClick={startNewTrip} disabled={starting}>
          {starting ? 'Starting…' : 'Start a new trip'}
        </button>
      </div>

      {startError && (
        <p role="alert" className="form-error">
          {startError}
        </p>
      )}

      <section aria-labelledby="trips-list-heading">
        <h2 id="trips-list-heading" className="sr-only">
          Your trips
        </h2>
        {loadStatus === 'loading' && <p>Loading…</p>}
        {loadStatus === 'error' && (
          <p role="alert" className="form-error">
            Couldn&rsquo;t load your trips. Try refreshing.
          </p>
        )}
        {loadStatus === 'ready' && trips.length === 0 && (
          <EmptyState>No trips yet — start one to get your first AI itinerary.</EmptyState>
        )}
        {loadStatus === 'ready' && trips.length > 0 && (
          <div className="trip-grid">
            {trips.map((trip) => (
              <button
                key={trip.id}
                type="button"
                className="trip-card"
                onClick={() => navigate(`/trips/${trip.id}`)}
              >
                <DestinationPhoto destination={trip.destination} thumbnail />
                <h2>{trip.tripTitle || trip.destination || 'Untitled trip'}</h2>
                <span className="status-pill">{trip.status}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
