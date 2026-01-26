console.log('=== ULTIMATE FIX VERSION - ' + new Date().toISOString() + ' ===');

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

// Join Waitlist - ULTIMATE FIX
app.post('/api/waitlist/join', async (req, res) => {
  try {
    console.log('\n🔵 === NEW REQUEST START ===');
    const { email, mobile } = req.body;
    console.log('📥 Raw input:', { email: email || '(empty)', mobile: mobile || '(empty)' });
    
    // Validate
    const hasEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const hasMobile = mobile && /^[0-9]{10,15}$/.test(mobile.replace(/\D/g, ''));
    
    console.log('✅ Validation:', { hasEmail, hasMobile });
    
    if (!hasEmail && !hasMobile) {
      console.log('❌ No valid input');
      return res.status(400).json({ 
        success: false,
        error: 'Please provide either a valid email or mobile number (10+ digits)' 
      });
    }
    
    const emailLower = hasEmail ? email.toLowerCase() : `mobile_${mobile.replace(/\D/g, '')}@dynaprizes.mobile`;
    const cleanMobile = hasMobile ? mobile.replace(/\D/g, '') : '';
    
    console.log('🔄 Processing:', { 
      emailLower, 
      cleanMobile: cleanMobile || '(empty)' 
    });
    
    // ===== ULTIMATE DUPLICATE CHECK =====
    let existingUser = null;
    let foundBy = 'none';
    
    // 1. Check email EXACTLY
    if (hasEmail) {
      console.log('🔍 Checking email in database:', emailLower);
      const emailResult = await WaitlistUser.findOne({ email: emailLower });
      console.log('📊 Email query result:', emailResult);
      
      if (emailResult && emailResult._id) {
        existingUser = emailResult;
        foundBy = 'email';
        console.log('🎯 FOUND by email:', emailResult.email);
      } else {
        console.log('❌ Email NOT found in database');
      }
    }
    
    // 2. Check mobile EXACTLY (only if email not found)
    if (!existingUser && hasMobile && cleanMobile) {
      console.log('🔍 Checking mobile in database:', cleanMobile);
      const mobileResult = await WaitlistUser.findOne({ mobile: cleanMobile });
      console.log('📊 Mobile query result:', mobileResult);
      
      if (mobileResult && mobileResult._id) {
        existingUser = mobileResult;
        foundBy = 'mobile';
        console.log('🎯 FOUND by mobile:', mobileResult.mobile);
      } else {
        console.log('❌ Mobile NOT found in database');
      }
    }
    
    console.log('📋 FINAL duplicate check:');
    console.log('   Existing user:', existingUser ? 'YES' : 'NO');
    console.log('   Found by:', foundBy);
    if (existingUser) {
      console.log('   User details:', {
        email: existingUser.email,
        mobile: existingUser.mobile,
        position: existingUser.position
      });
    }
    
    // ===== HANDLE DUPLICATE =====
    if (existingUser) {
      const totalCount = await WaitlistUser.countDocuments();
      console.log('🚫 DUPLICATE - Returning error. Total users:', totalCount);
      
      return res.json({
        success: false,  // MUST BE false for duplicates
        message: 'You are already on the waitlist!',
        position: existingUser.position,
        referralCode: existingUser.referralCode,
        total: totalCount
      });
    }
    
    // ===== CREATE NEW USER =====
    console.log('🆕 Creating NEW user...');
    const totalUsers = await WaitlistUser.countDocuments();
    const position = totalUsers + 1;
    const referralCode = 'DYN' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    console.log('📝 New user data:', {
      email: emailLower,
      mobile: cleanMobile || '(empty)',
      position,
      referralCode
    });
    
    const user = await WaitlistUser.create({
      email: emailLower,
      mobile: cleanMobile,
      position: position,
      referralCode: referralCode,
      joinedAt: new Date()
    });
    
    const newTotal = await WaitlistUser.countDocuments();
    console.log('✅ User CREATED successfully!');
    console.log('   Email:', user.email);
    console.log('   Position:', user.position);
    console.log('   Total users now:', newTotal);
    
    res.json({
      success: true,
      message: hasEmail ? '🎉 Successfully joined with email!' : '🎉 Successfully joined with mobile!',
      position: user.position,
      referralCode: user.referralCode,
      total: newTotal
    });
    
    console.log('🟢 === REQUEST END ===\n');
    
  } catch (error) {
    console.error('💥 SERVER ERROR:', error);
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
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
