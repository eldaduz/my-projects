import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDB() {
  mongoose.set('strictQuery', true)

  try {
    await mongoose.connect(env.mongoUri)
    console.log('MongoDB connected')
  } catch (err) {
    // Never log the connection string: it may contain credentials. err.name
    // (e.g. MongooseServerSelectionError) is safe and useful for local debugging.
    console.error('MongoDB connection failed. Check MONGODB_URI and database availability.')
    if (env.nodeEnv !== 'production') {
      console.error(`Reason: ${err.name}`)
    }
    throw new Error('Database connection failed')
  }
}

export async function disconnectDB() {
  await mongoose.disconnect()
}
