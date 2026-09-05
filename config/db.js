const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');

  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: Number(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || 10000),
    maxPoolSize: Number(process.env.DB_MAX_POOL_SIZE || 10),
    minPoolSize: Number(process.env.DB_MIN_POOL_SIZE || 1),
    socketTimeoutMS: Number(process.env.DB_SOCKET_TIMEOUT_MS || 45000),
  });

  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
};

mongoose.connection.on('error', (error) => console.error('MongoDB error:', error.message));
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));

module.exports = connectDB;
