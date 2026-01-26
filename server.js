console.log('=== FIXED VERSION - ' + new Date().toISOString() + ' ===');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dynaprizes_app:Dynaprizes2026@cluster0.welog2q.mongodb.net/dynaprizes?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.log('❌ MongoDB Error:', err.message));

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
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ status: 'error', error: error.message });
  }
});

// Join Waitlist - MAIN FIX
app.post('/api/waitlist/join', async (req, res) => {
  try {
    console.log('\n=== JOIN REQUEST ===');
    const { email, mobile } = req.body;
    console.log('Received:', { email, mobile });
    
    // Validate
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
    
    console.log('Processing:', { emailLower, cleanMobile });
    
    // SIMPLE DUPLICATE CHECK - NO $or, NO complex queries
    let existingUser = null;
    
    if (hasEmail) {
      console.log('Checking email:', emailLower);
      existingUser = await WaitlistUser.findOne({ email: emailLower });
      console.log('Email check result:', existingUser ? 'FOUND' : 'NOT FOUND');
    }
    
    if (!existingUser && hasMobile && cleanMobile) {
      console.log('Checking mobile:', cleanMobile);
      existingUser = await WaitlistUser.findOne({ mobile: cleanMobile });
      console.log('Mobile check result:', existingUser ? 'FOUND' : 'NOT FOUND');
    }
    
    // If duplicate found
    if (existingUser) {
      console.log('DUPLICATE FOUND:', {
        email: existingUser.email,
        mobile: existingUser.mobile,
        position: existingUser.position
      });
      return res.json({
        success: false,  // <--- FIXED: false for duplicates
        message: 'You are already on the waitlist!',
        position: existingUser.position,
        referralCode: existingUser.referralCode,
        total: await WaitlistUser.countDocuments()
      });
    }
    
    // Create new user
    console.log('Creating NEW user...');
    const totalUsers = await WaitlistUser.countDocuments();
    const position = totalUsers + 1;
    const referralCode = 'DYN' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const user = await WaitlistUser.create({
      email: emailLower,
      mobile: cleanMobile,
      position: position,
      referralCode: referralCode,
      joinedAt: new Date()
    });
    
    console.log('User created:', { 
      email: user.email, 
      position: user.position,
      totalUsers: totalUsers + 1 
    });
    
    res.json({
      success: true,
      message: hasEmail ? '🎉 Successfully joined with email!' : '🎉 Successfully joined with mobile!',
      position: user.position,
      referralCode: user.referralCode,
      total: await WaitlistUser.countDocuments()
    });
    
  } catch (error) {
    console.error('ERROR:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
});

// Stats
app.get('/api/waitlist/stats', async (req, res) => {
  try {
    const total = await WaitlistUser.countDocuments();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayCount = await WaitlistUser.countDocuments({ joinedAt: { $gte: today } });
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = await WaitlistUser.countDocuments({ joinedAt: { $gte: weekAgo } });
    
    res.json({ total, today: todayCount, week: weekCount, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin
app.get('/api/waitlist/admin/users', async (req, res) => {
  try {
    const users = await WaitlistUser.find().sort({ joinedAt: -1 });
    res.json({ success: true, total: users.length, users });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
