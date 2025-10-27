const mongoose = require('mongoose');

async function initMongo() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/202010832';
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000
  });
  return mongoose.connection;
}

module.exports = { initMongo };
