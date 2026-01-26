console.log('=== DEBUG VERSION - ' + new Date().toISOString() + ' ===');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dynaprizes_app:Dynaprizes2026@cluster0.welog2q.mongodb.net/dynaprizes?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => console.log('✅ MongoDB Connected to:', mongoose.connection.db.databaseName))
.catch(err => console.log('❌ MongoDB Error:', err.message));

const userSchema = new mongoose.Schema({
  email: String,
  mobile: String,
  position: Number,
  referralCode: String,
  joinedAt: { type: Date, default: Date.now }
});
const WaitlistUser = mongoose.model('WaitlistUser', userSchema);

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

app.post('/api/waitlist/join', async (req, res) => {
  try {
    console.log('\n🔵 === NEW REQUEST START ===');
    const { email, mobile } = req.body;
    console.log('📥 Raw input:', { email: email || '(empty)', mobile: mobile || '(empty)' });
    
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
    
    console.log('🔄 Processing:', { emailLower, cleanMobile: cleanMobile || '(empty)' });
    
    // ===== ULTIMATE DEBUG - DIRECT MONGODB QUERY =====
    console.log('\n🔍 === MONGODB DIRECT QUERY DEBUG ===');
    
    // Get native MongoDB collection
    const db = mongoose.connection.db;
    const collection = db.collection('waitlistusers');
    
    // Query 1: Native MongoDB driver
    console.log('1. Native MongoDB query for email:', emailLower);
    const nativeQuery = { email: emailLower };
    const nativeResult = await collection.findOne(nativeQuery);
    console.log('   Native result:', nativeResult);
    console.log('   Native found?', nativeResult ? 'YES' : 'NO');
    
    // Query 2: Mongoose
    console.log('2. Mongoose query for email:', emailLower);
    const mongooseQuery = { email: emailLower };
    const mongooseResult = await WaitlistUser.findOne(mongooseQuery);
    console.log('   Mongoose result:', mongooseResult);
    console.log('   Mongoose found?', mongooseResult ? 'YES' : 'NO');
    
    // Query 3: Find ALL users (debug)
    console.log('3. All users in collection:');
    const allUsers = await collection.find({}).limit(5).toArray();
    console.log('   First 5 users:', allUsers.map(u => ({ email: u.email, mobile: u.mobile })));
    
    // ===== DECISION LOGIC =====
    let existingUser = null;
    if (nativeResult) {
      existingUser = nativeResult;
      console.log('🎯 Using NATIVE result as existing user');
    } else if (mongooseResult) {
      existingUser = mongooseResult;
      console.log('🎯 Using MONGOOSE result as existing user');
    } else {
      console.log('✅ No existing user found - EMAIL IS NEW');
    }
    
    console.log('📋 FINAL existingUser:', existingUser ? 'YES' : 'NO');
    if (existingUser) {
      console.log('   Details:', {
        email: existingUser.email,
        mobile: existingUser.mobile,
        position: existingUser.position
      });
    }
    
    // ===== HANDLE RESULT =====
    if (existingUser) {
      console.log('🚫 DUPLICATE DETECTED');
      return res.json({
        success: false,
        message: 'You are already on the waitlist!',
        position: existingUser.position,
        referralCode: existingUser.referralCode,
        total: await WaitlistUser.countDocuments()
      });
    }
    
    // ===== CREATE NEW USER =====
    console.log('🆕 CREATING NEW USER');
    const totalUsers = await WaitlistUser.countDocuments();
    const position = totalUsers + 1;
    const referralCode = 'DYN' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    console.log('📝 New user data:', { email: emailLower, position, referralCode });
    
    const user = await WaitlistUser.create({
      email: emailLower,
      mobile: cleanMobile,
      position: position,
      referralCode: referralCode,
      joinedAt: new Date()
    });
    
    console.log('✅ USER CREATED:', { 
      email: user.email, 
      position: user.position,
      id: user._id 
    });
    
    res.json({
      success: true,
      message: hasEmail ? '🎉 Successfully joined with email!' : '🎉 Successfully joined with mobile!',
      position: user.position,
      referralCode: user.referralCode,
      total: await WaitlistUser.countDocuments()
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

app.get('/api/waitlist/admin/users', async (req, res) => {
  try {
    const users = await WaitlistUser.find().sort({ joinedAt: -1 });
    res.json({ success: true, total: users.length, users });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Dynaprizes Waitlist API',
    endpoints: ['/health', '/api/waitlist/join', '/api/waitlist/stats', '/api/waitlist/admin/users']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
