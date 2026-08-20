# AI Trip Planner

## Project Overview

AI Trip Planner is a full-stack itinerary planning app. Users build a trip profile (destination, dates, travelers, preferences), then generate and iteratively replan a day-by-day itinerary through a Gemini-backed AI boundary.

## Live Architecture

- Frontend: Vercel (React/Vite), proxies `/api/*` to the backend so cookies stay same-origin
- Backend API: Render Web Service (Node.js/Express)
- Database: MongoDB Atlas
- AI: Gemini API (backend-only — the client never talks to Gemini directly)

## Features

- Registration/login with JWT session cookies (HttpOnly, SameSite=Lax)
- Trip and traveler-profile CRUD, owner-scoped
- Guided trip questionnaire with a readiness gate before generation
- AI itinerary generation and natural-language replanning
- AI abuse protection: per-user/IP rate limiting, concurrency guard, stale-operation recovery
- CSRF defense via Origin validation on state-changing requests

## Tech Stack

- React, Vite
- Express, Mongoose
- MongoDB Atlas
- JWT authentication (httpOnly cookies)
- Google Gemini API
- Render, Vercel

## Repository Structure

```text
AI-Trip-Planner/
  client/
    public/
    src/
    index.html
    package.json
    vercel.json
    vite.config.js
  server/
    src/
      config/
      middleware/
      modules/
      routes/
      app.js
      server.js
    .env.example
    package.json
  README.md
```

## Local Setup

### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend local URL: `http://localhost:5173`

### Backend

```bash
cd server
npm install
npm start
```

Backend local URL: `http://localhost:5000`

## Environment Variables

Backend variables are documented in `server/.env.example`.

Required backend variables:

- `MONGODB_URI`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `CORS_ORIGIN` — must be the deployed Vercel URL in production

Optional backend variables (sane defaults in code): `PORT`, `GEMINI_MODEL`, `JSON_BODY_LIMIT`, `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`, `AI_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_MS`, `AI_RATE_LIMIT_IP_MAX`, `AI_STALE_OPERATION_MS`.

The frontend has no build-time API URL to configure — it always calls the relative path `/api`, which `client/vercel.json` rewrites to the Render backend.

## Deployment Notes

- The frontend calls `/api/*` as a relative path; `client/vercel.json` rewrites those requests server-side to the Render backend, so the browser only ever talks to the Vercel origin and cookies remain same-origin (no cross-site cookie configuration needed).
- **After creating the Render service**, replace the placeholder host in `client/vercel.json`'s rewrite destination with the real `https://<service>.onrender.com` URL, then redeploy the Vercel project.
- Set `CORS_ORIGIN` on Render to the deployed Vercel URL (not `localhost`) once it's known.
- `AI_ADAPTER_MODE` (fake AI adapter for testing) is hard-disabled whenever `NODE_ENV=production` — it cannot be enabled in this deployment regardless of env vars.
- No Redis, queue, worker, staging environment, or Docker is required for this deployment.

## API Summary

Primary backend route groups:

- `/api/auth`
- `/api/trips`
- `/api/traveler-profiles`
- `/api/health`

## Known Constraints / Future Improvements

- Add screenshots and a live demo link once deployment is verified end-to-end.
