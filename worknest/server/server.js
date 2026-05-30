import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 3005;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`WorkNest API is running on port ${PORT}`);
  });
};

startServer();
