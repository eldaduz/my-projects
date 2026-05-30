# WorkNest

## Project Overview

WorkNest is a full-stack coworking reservation platform built as a portfolio-ready product. It lets users browse branches, explore workspace types, sign in, manage reservations, and complete booking flows with an admin dashboard for operational management.

## Live Architecture

- Frontend: Vercel
- Backend API: Render Web Service
- Database: MongoDB Atlas

## Features

- Public branch browsing with location detail pages
- Workspace discovery by branch and workspace type
- User registration and login with JWT-based auth
- Reservation creation, confirmation, and cancellation
- My Reservations dashboard for authenticated users
- Admin dashboard for branch, workspace, and reservation management
- RTL-first UI with portfolio-oriented visual polish

## Tech Stack

- React
- Vite
- Express
- MongoDB Atlas
- Mongoose
- JWT authentication
- Render
- Vercel

## Repository Structure

```text
worknest/
  client/
    public/
    src/
    index.html
    package.json
    vercel.json
    vite.config.js
  server/
    config/
    controllers/
    middleware/
    models/
    routes/
    seed/
    services/
    utils/
    .env.example
    app.js
    package.json
    server.js
  README.md
```

## Local Setup

### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend local URL:

- `http://localhost:5173`

### Backend

```bash
cd server
npm install
npm start
```

Backend local URL:

- `http://localhost:3005`
- Health check: `http://localhost:3005/api/health`

## Environment Variables

Backend variables are documented in `server/.env.example`.

Required backend variables:

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `NODE_ENV`

Optional frontend variable:

- `VITE_API_BASE_URL`

Local frontend fallback:

- `http://localhost:3005/api`

## Demo Flow

1. Open the public homepage and browse available WorkNest branches.
2. Enter a branch page and review available workspaces.
3. Log in or register through the modal-based auth flow.
4. Create a reservation for a workspace and review the success state.
5. Open My Reservations to inspect or cancel existing reservations.
6. Sign in as an admin user to access operational management flows.

## API Summary

Primary backend route groups:

- `/api/auth`
- `/api/branches`
- `/api/reservations`
- `/api/workspaces`
- `/api/health`

Examples:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/branches`
- `GET /api/branches/:branchId`
- `GET /api/branches/:branchId/workspaces`
- `GET /api/workspaces/:workspaceId`
- `GET /api/workspaces/available`
- `GET /api/reservations/my`
- `POST /api/reservations`
- `PATCH /api/reservations/:reservationId/cancel`

## Deployment Notes

- The frontend is prepared for Vercel and includes `client/vercel.json` for SPA rewrites.
- The backend is prepared for Render as a standalone Node service.
- The frontend can point to the deployed backend through `VITE_API_BASE_URL`.
- The backend CORS configuration accepts local development plus the deployed client URL through `CLIENT_URL`.

## Known Constraints / Future Improvements

- Replace the current lightweight pathname router with a dedicated routing library if the app grows.
- Add a dedicated extracted test strategy if portfolio CI or E2E validation is required later.
- Add screenshots and live links once deployment is complete.
- Optionally align workspace seed image paths and asset naming more formally in a future cleanup pass.
