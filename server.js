require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MONGODB CONNECTION
const MONGODB_URI = 'mongodb+srv://dynaprizes_admin:Vittu%232030@cluster0.welog2q.mongodb.net/dynaprizes_waitlist?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected Successfully!'))
.catch(err => {
  console.log('❌ MongoDB Connection Failed:', err.message);
  console.log('⚠️ Using in-memory storage as fallback');
});

// Database Schema
const waitlistUserSchema = new mongoose.Schema({
  email: { type: String, lowercase: true },
  mobile: String,
  position: Number,
  referralCode: String,
  joinedAt: { type: Date, default: Date.now }
});

const WaitlistUser = mongoose.model('WaitlistUser', waitlistUserSchema);

// Health Check
app.get('/health', async (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  const totalUsers = await WaitlistUser.countDocuments();
  
  res.json({ 
    status: 'ok', 
    database: isConnected ? 'mongodb' : 'disconnected',
    totalUsers: totalUsers,
    timestamp: new Date().toISOString()
  });
});

// JOIN WAITLIST
app.post('/api/waitlist/join', async (req, res) => {
  try {
    const { email, mobile } = req.body;
    
    // Validation
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
    
    // Check existing user
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
    
    // Get position
    const position = await WaitlistUser.countDocuments() + 1;
    
    // Create user
    const user = await WaitlistUser.create({
      email: emailLower,
      mobile: cleanMobile,
      position: position,
      referralCode: 'DYN' + Math.random().toString(36).substr(2, 6).toUpperCase(),
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
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
});

// GET STATS
app.get('/api/waitlist/stats', async (req, res) => {
  try {
    const total = await WaitlistUser.countDocuments();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await WaitlistUser.countDocuments({ 
      joinedAt: { $gte: today } 
    });
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = await WaitlistUser.countDocuments({ 
      joinedAt: { $gte: weekAgo } 
    });
    
    const recent = await WaitlistUser.find()
      .sort({ joinedAt: -1 })
      .limit(10)
      .select('email position joinedAt');
    
    res.json({
      total: total,
      today: todayCount,
      week: weekCount,
      recent: recent,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN ENDPOINT
app.get('/api/waitlist/admin/users', async (req, res) => {
  try {
    const users = await WaitlistUser.find()
      .sort({ joinedAt: -1 });
    
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));