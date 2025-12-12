require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// ===> FINAL MONGODB CONNECTION STRING <===

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dynaprizes_app:Dynaprizes2024!@cluster0.welog2q.mongodb.net/dynaprizes?retryWrites=true&w=majority&appName=Cluster0';

// ===> MONGODB CONNECTION WITH PROPER LOGGING <===
console.log('🔗 Attempting MongoDB connection...');
console.log('URI:', MONGODB_URI);

mongoose.connect(MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000, // 10 second timeout
  socketTimeoutMS: 45000
})
.then(() => {
  console.log('✅ MONGODB CONNECTED SUCCESSFULLY!');
  console.log('Database name:', mongoose.connection.db?.databaseName);
  console.log('Connection state:', mongoose.connection.readyState);
})
.catch(err => {
  console.log('❌ MONGODB CONNECTION FAILED!');
  console.log('Error name:', err.name);
  console.log('Error message:', err.message);
  console.log('Full error:', err);
});

// Event listeners
mongoose.connection.on('error', err => {
  console.log('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

// User Schema
const userSchema = new mongoose.Schema({
  email: String,
  mobile: String,
  position: Number,
  referralCode: String,
  joinedAt: { type: Date, default: Date.now }
});
const WaitlistUser = mongoose.model('WaitlistUser', userSchema);

// Health Check Endpoint (MUST SHOW "mongodb" if connected)
app.get('/health', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    
    if (!isConnected) {
      // Try to check if we're in the process of connecting
      return res.json({ 
        status: 'connecting', 
        totalUsers: 0,
        database: 'connecting',
        timestamp: new Date().toISOString(),
        message: 'MongoDB connection establishing...'
      });
    }
    
    // Only count documents if connected
    const total = await mongoose.connection.db ? 
      await mongoose.connection.db.collection('waitlistusers').countDocuments() : 0;
    
    res.json({ 
      status: 'ok', 
      totalUsers: total,
      database: 'mongodb',
      timestamp: new Date().toISOString(),
      message: '✅ Fully connected to MongoDB'
    });
    
  } catch (error) {
    res.json({ 
      status: 'error', 
      totalUsers: 0,
      database: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});
// Join Waitlist Endpoint
app.post('/api/waitlist/join', async (req, res) => {
  try {
    const { email, mobile } = req.body;
    const hasEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const hasMobile = mobile && /^[0-9]{10,15}$/.test(mobile.replace(/\D/g, ''));
    
    if (!hasEmail && !hasMobile) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide either a valid email or mobile number (10+ digits)' 
      });
    }
    
    const emailLower = hasEmail ? email.toLowerCase() : `mobile_${mobile.replace(/\D/g, '')}@dynaprizes.mobile`;
    const cleanMobile = hasMobile ? mobile.replace(/\D/g, '') : '';
    
    const existingUser = await WaitlistUser.findOne({
      $or: [
        { email: emailLower },
        { mobile: cleanMobile }
      ]
    });
    
    if (existingUser) {
      return res.json({
        success: true,
        message: 'You are already on the waitlist!',
        position: existingUser.position,
        referralCode: existingUser.referralCode,
        total: await WaitlistUser.countDocuments()
      });
    }
    
    const position = await WaitlistUser.countDocuments() + 1;
    const referralCode = 'DYN' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const user = await WaitlistUser.create({
      email: emailLower,
      mobile: cleanMobile,
      position: position,
      referralCode: referralCode,
      joinedAt: new Date()
    });
    
    res.json({
      success: true,
      message: hasEmail && hasMobile ? 
        '🎉 Successfully joined waitlist!' :
        hasEmail ? '🎉 Successfully joined with email!' :
        '🎉 Successfully joined with mobile!',
      position: user.position,
      referralCode: user.referralCode,
      total: await WaitlistUser.countDocuments()
    });
    
  } catch (error) {
    console.error('Join error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
});

// Get Stats Endpoint
app.get('/api/waitlist/stats', async (req, res) => {
  try {
    const total = await WaitlistUser.countDocuments();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayCount = await WaitlistUser.countDocuments({ joinedAt: { $gte: today } });
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = await WaitlistUser.countDocuments({ joinedAt: { $gte: weekAgo } });
    
    res.json({
      total: total,
      today: todayCount,
      week: weekCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Users Endpoint
app.get('/api/waitlist/admin/users', async (req, res) => {
  try {
    const users = await WaitlistUser.find().sort({ joinedAt: -1 });
    res.json({ 
      success: true, 
      total: users.length,
      users: users 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Dynaprizes Waitlist API',
    endpoints: [
      '/health',
      '/api/waitlist/join (POST)',
      '/api/waitlist/stats (GET)', 
      '/api/waitlist/admin/users (GET)'
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));