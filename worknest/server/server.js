import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';

// Load .env before any module reads process.env (DB URI, JWT secret, etc.).

dotenv.config();

// Connect to MongoDB before accepting HTTP requests.
// If the DB is unreachable the process fails immediately instead of serving broken responses.

const PORT = process.env.PORT || 3005;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`WorkNest API is running on port ${PORT}`);
  });
};

startServer();
