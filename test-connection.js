const mongoose = require('mongoose');
require('dotenv').config();

console.log('Testing MongoDB connection...');
console.log('MONGODB_URI from .env:', process.env.MONGODB_URI ? 'Loaded' : 'Not loaded');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
})
.then(() => {
  console.log('✅ SUCCESS: MongoDB Connected!');
  console.log('Host:', mongoose.connection.host);
  console.log('Database:', mongoose.connection.db?.databaseName);
  process.exit(0);
})
.catch(err => {
  console.error('❌ ERROR:', err.message);
  console.error('Full error:', err);
  process.exit(1);
});
