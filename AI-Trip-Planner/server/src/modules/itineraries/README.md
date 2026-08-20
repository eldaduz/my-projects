# Itineraries module

Domain logic for `CurrentItinerary` (manual editing, CURRENT/STALE lifecycle). Implemented starting
in F15 (ATP-20) and F16 (ATP-21). Routes are nested under `/api/trips/:id/itinerary`, not exposed as
a separate top-level resource — see `SYSTEM_DESIGN.md` §5.
