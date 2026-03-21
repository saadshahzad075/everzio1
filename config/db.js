// ══════════════════════════════════════════════════
// config/db.js — MongoDB Connection
// ══════════════════════════════════════════════════
// HOW TO USE:
//   1. Set MONGODB_URI in your .env file
//   2. Local:  mongodb://localhost:27017/everzio
//   3. Atlas:  mongodb+srv://user:pass@cluster.mongodb.net/everzio
// ══════════════════════════════════════════════════

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

module.exports = connectDB;
