import cors from 'cors';
import express from 'express';
import errorMiddleware from './middleware/errorMiddleware.js';
import notFoundMiddleware from './middleware/notFoundMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';

const app = express();

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

app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api', workspaceRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    message: 'WorkNest API is running',
    data: {
      status: 'ok',
    },
  });
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
