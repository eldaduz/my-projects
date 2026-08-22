import { useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';

// ponytail: in-memory only, no TTL/eviction — fine for a session's worth of
// trip cards; add expiry if this ever needs to reflect photo changes live.
const photoCache = new Map();

export function DestinationPhoto({ destination, thumbnail = false }) {
  const [photo, setPhoto] = useState(() => (destination && photoCache.get(destination)) || null);

  useEffect(() => {
    let cancelled = false;
    // Intentional one-time flush of stale data from a previous prop set, before
    // this effect's own fetch resolves — not an unconditional cascading update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhoto(null);

    if (!destination) return undefined;

    if (photoCache.has(destination)) {
      setPhoto(photoCache.get(destination));
      return undefined;
    }

    apiClient
      .get(`/enrichment/photo?destination=${encodeURIComponent(destination)}`)
      .then((data) => {
        const result = data.available ? data : null;
        photoCache.set(destination, result);
        if (!cancelled) setPhoto(result);
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
    <figure className="destination-photo" aria-hidden={thumbnail || undefined}>
      <img src={photo.url} alt={thumbnail ? '' : destination} />
      {!thumbnail && <figcaption>{photo.attribution}</figcaption>}
    </figure>
  );
}
