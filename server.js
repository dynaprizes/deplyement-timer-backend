console.log('=== NEW CODE VERSION - ' + new Date().toISOString() + ' ===');
console.log('Timestamp:', new Date().toISOString());
console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// ===> FINAL MONGODB CONNECTION STRING <===
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dynaprizes_app:Dynaprizes2026@cluster0.welog2q.mongodb.net/dynaprizes?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔗 Attempting MongoDB connection...');
mongoose.connect(MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000
})
.then(() => {
  console.log('✅ MONGODB CONNECTED SUCCESSFULLY!');
  console.log('Database name:', mongoose.connection.db?.databaseName);
})
.catch(err => {
  console.log('❌ MONGODB CONNECTION FAILED:', err.message);
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

// Health Check
app.get('/health', async (req, res) => {
  try {
    const total = await WaitlistUser.countDocuments();
    res.json({ 
      status: 'ok', 
      totalUsers: total,
      database: 'connected',
      timestamp: new Date().toISOString(),
      message: '✅ MongoDB connected'
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

// Join Waitlist Endpoint - FIXED
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
    
    // DEBUG
    console.log('=== EXACT DUPLICATE CHECK ===');
    console.log('Searching for email:', emailLower);
    console.log('Database total users:', await WaitlistUser.countDocuments());

    let existingUser = null;

    // Check by email (if provided)
    if (hasEmail) {
      existingUser = await WaitlistUser.findOne({ email: emailLower });
      console.log('Email check result:', existingUser ? 'FOUND' : 'NOT FOUND');
      if (existingUser) {
        console.log('Found user email:', existingUser.email);
      }
    }

    // Check by mobile (if provided AND email not found)
    if (!existingUser && hasMobile && cleanMobile) {
      existingUser = await WaitlistUser.findOne({ mobile: cleanMobile });
      console.log('Mobile check result:', existingUser ? 'FOUND' : 'NOT FOUND');
    }
    
    if (existingUser) {
      console.log('RETURNING: Already registered');
      return res.json({
        success: false,  // CHANGED FROM true TO false
        message: 'You are already on the waitlist!',
        position: existingUser.position,
        referralCode: existingUser.referralCode,
        total: await WaitlistUser.countDocuments()
      });
    }
    
    // Create new user
    const position = await WaitlistUser.countDocuments() + 1;
    const referralCode = 'DYN' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const user = await WaitlistUser.create({
      email: emailLower,
      mobile: cleanMobile,
      position: position,
      referralCode: referralCode,
      joinedAt: new Date()
    });
    
    console.log('RETURNING: New user created at position', position);
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

// Test endpoint
app.get('/api/test', async (req, res) => {
  const testEmail = 'test_' + Date.now() + '@test.com';
  const result = await WaitlistUser.findOne({ email: testEmail });
  res.json({ 
    testEmail, 
    found: result ? 'YES' : 'NO',
    totalUsers: await WaitlistUser.countDocuments()
  });
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
      '/api/waitlist/admin/users (GET)',
      '/api/test (GET)'
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
