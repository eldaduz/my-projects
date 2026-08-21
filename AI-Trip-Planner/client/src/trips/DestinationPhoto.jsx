import { useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';

export function DestinationPhoto({ destination }) {
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Intentional one-time flush of stale data from a previous prop set, before
    // this effect's own fetch resolves — not an unconditional cascading update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhoto(null);

    if (!destination) return undefined;

    apiClient
      .get(`/enrichment/photo?destination=${encodeURIComponent(destination)}`)
      .then((data) => {
        if (!cancelled) setPhoto(data.available ? data : null);
      })
      .catch(() => {
        if (!cancelled) setPhoto(null);
      });

    return () => {
      cancelled = true;
    };
  }, [destination]);

  if (!photo) return null;

  return (
    <figure className="destination-photo">
      <img src={photo.url} alt={destination} />
      <figcaption>{photo.attribution}</figcaption>
    </figure>
  );
}
