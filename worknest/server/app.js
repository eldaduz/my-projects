import cors from 'cors';
import express from 'express';
import errorMiddleware from './middleware/errorMiddleware.js';
import notFoundMiddleware from './middleware/notFoundMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';

const app = express();

// CORS whitelist: allow the Vite dev server and an optional production origin from .env.
const allowedOrigins = ['http://localhost:5173'];

if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
  }),
);
app.use(express.json());

// Each resource gets its own route prefix.
// Workspace routes mount at /api (not /api/workspaces) because some endpoints
// live under /api/branches/:branchId/workspaces.
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api', workspaceRoutes);

// Health endpoint for deployment monitoring (load balancers, uptime checks).
app.get('/api/health', (req, res) => {
  res.status(200).json({
    message: 'WorkNest API is running',
    data: {
      status: 'ok',
    },
  });
});

// These must be last: 404 catches unmatched routes, error handler catches thrown errors.
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
