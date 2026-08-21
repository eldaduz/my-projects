import { useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';

export function TripWeather({ destination, startDate, endDate }) {
  const [days, setDays] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Intentional one-time flush of stale data from a previous prop set, before
    // this effect's own fetch resolves — not an unconditional cascading update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDays(null);

    if (!destination || !startDate || !endDate) return undefined;

    // Persisted trips carry startDate/endDate as full ISO timestamps
    // (e.g. "2026-09-01T00:00:00.000Z"), but the weather endpoint requires
    // YYYY-MM-DD — same slicing convention as shared/dateFormat.js.
    const startDateOnly = startDate.slice(0, 10);
    const endDateOnly = endDate.slice(0, 10);

    apiClient
      .get(`/enrichment/weather?destination=${encodeURIComponent(destination)}&startDate=${startDateOnly}&endDate=${endDateOnly}`)
      .then((data) => {
        if (!cancelled) setDays(data.available ? data.days : []);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });

    return () => {
      cancelled = true;
    };
  }, [destination, startDate, endDate]);

  if (!days || days.length === 0) return null;

  return (
    <div className="trip-weather" aria-label="Weather forecast">
      {days.map((day) => (
        <div key={day.date} className="trip-weather__day">
          <span>{day.date}</span>
          <span>
            {Math.round(day.tempMaxC)}° / {Math.round(day.tempMinC)}°C
          </span>
        </div>
      ))}
    </div>
  );
}
