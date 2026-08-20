# AI module

F11 owns the stateless AI boundary only:

- `buildPlanningContext(trip)` explicitly maps a Trip into application-owned JSON.
- `createGeminiAdapter()` sends the two fixed stateless operations (`GENERATE` and
  `CORRECT_INVALID_ITINERARY`) and returns raw provider text.
- `createFakeGeminiAdapter()` provides the same callable contract for network-free tests.

The adapter owns `GEMINI_API_KEY` and `GEMINI_MODEL`; callers cannot supply prompts, sessions,
history, retries, or provider parameters. Generation orchestration validates output before
persistence and allows one corrective pass. See `SYSTEM_DESIGN.md` §6.
