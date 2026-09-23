# AI Trip Planner

Structured traveler preferences + trip-specific context → personalized AI itinerary → manual
editing and controlled AI replanning. See `PRD.md` and `SYSTEM_DESIGN.md` for the frozen product
and technical baselines, and `AGENTS.md` for the delivery workflow.

## Stack

`client/` — React + Vite SPA
`server/` — Node.js/Express modular monolith (`auth`, `travelers`, `trips`, `itineraries`, `ai`)
MongoDB (Atlas in production) via Mongoose. Gemini is called only by the backend.

## Getting started

```bash
npm run install:all          # installs client and server dependencies
cp server/.env.example server/.env
# edit server/.env with a real MONGODB_URI (Atlas or local MongoDB)

npm run server:dev           # http://localhost:5000
npm run client:dev           # http://localhost:5173, proxies /api -> the server
```

The client's Vite dev server proxies `/api/*` to the backend (`BACKEND_PORT`, default `5000`), the
same pattern used in production via the Vercel `/api` rewrite to Render.

## Quality gates

```bash
npm run lint     # client + server
npm run test     # client + server
npm run build    # client production build
```

## Environment variables

See `server/.env.example`. `MONGODB_URI` is required at startup; `JWT_SECRET` and `GEMINI_API_KEY`
are read but not required until the Features that use them (F02, F11) are implemented.
