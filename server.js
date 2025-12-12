require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://dynaprizes_admin:vittu%23214@cluster0.welog2q.mongodb.net/dynaprizes?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Import WaitlistUser model from file
const WaitlistUser = require('./models/WaitlistUser');

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const count = await WaitlistUser.countDocuments();
    
    res.json({ 
      status: 'ok', 
      database: dbStatus,
      totalUsers: count,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.json({ 
      status: 'error', 
      database: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// JOIN waitlist (from your waitlist.js)
app.post('/api/waitlist/join', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    
    // Check if already joined
    const existingUser = await WaitlistUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.json({
        success: true,
        message: 'You are already on the waitlist!',
        position: existingUser.position,
        referralCode: existingUser.referralCode
      });
    }
    
    // Create new user
    const user = new WaitlistUser({
      email: email.toLowerCase(),
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        source: req.body.source || 'website'
      }
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Successfully joined waitlist!',
      position: user.position,
      referralCode: user.referralCode,
      referralLink: `https://dynaprizes.com/?ref=${user.referralCode}`
    });
    
  } catch (error) {
    console.error('Join error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// GET stats
app.get('/api/waitlist/stats', async (req, res) => {
  try {
    const total = await WaitlistUser.countDocuments();
    
    // Today's count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await WaitlistUser.countDocuments({
      joinedAt: { $gte: today }
    });
    
    res.json({
      total: total,
      today: todayCount,
      week: total, // Simplified for now
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN endpoint
app.get('/api/waitlist/admin/users', async (req, res) => {
  try {
    const users = await WaitlistUser.find()
      .sort({ joinedAt: -1 })
      .select('email position referralCode joinedAt -_id');
    
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
    message: 'Dynaprizes Waitlist API',
    endpoints: ['/health', '/api/waitlist/join', '/api/waitlist/stats', '/api/waitlist/admin/users']
  });
});

// Export
module.exports = app;
