require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// IN-MEMORY DATABASE (ALWAYS WORKS)
let waitlistUsers = [];
let userCounter = 1;

console.log('🚀 Dynaprizes Waitlist API Started (In-Memory Mode)');

// Generate referral code
function generateReferralCode() {
  return 'DYN' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Health check (always working)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: 'in-memory',
    totalUsers: waitlistUsers.length,
    timestamp: new Date().toISOString(),
    message: '✅ API is fully functional with in-memory storage'
  });
});

// TEST endpoint
app.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend running perfectly',
    totalUsers: waitlistUsers.length
  });
});

// JOIN WAITLIST (UPDATED - accepts mobile-only)
app.post('/api/waitlist/join', async (req, res) => {
  try {
    const { email, mobile } = req.body;
    
    // NEW VALIDATION: Accept EITHER email OR mobile
    const hasEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const hasMobile = mobile && /^[0-9]{10,15}$/.test(mobile.replace(/\D/g, ''));
    
    if (!hasEmail && !hasMobile) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide either a valid email or mobile number (10+ digits)' 
      });
    }
    
    // Check if already joined (by email OR mobile)
    let existingUser = null;
    
    if (hasEmail) {
      const emailLower = email.toLowerCase();
      existingUser = waitlistUsers.find(u => u.email === emailLower);
    }
    
    if (!existingUser && hasMobile) {
      const cleanMobile = mobile.replace(/\D/g, '');
      existingUser = waitlistUsers.find(u => u.mobile === cleanMobile);
    }
    
    if (existingUser) {
      return res.json({
        success: true,
        message: 'You are already on the waitlist!',
        position: existingUser.position,
        referralCode: existingUser.referralCode,
        total: waitlistUsers.length
      });
    }
    
    // Create new user
    const position = waitlistUsers.length + 1;
    const user = {
      id: userCounter++,
      email: hasEmail ? email.toLowerCase() : `mobile_${mobile.replace(/\D/g, '')}@dynaprizes.mobile`,
      mobile: hasMobile ? mobile.replace(/\D/g, '') : '',
      position: position,
      referralCode: generateReferralCode(),
      joinedAt: new Date().toISOString(),
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        source: 'website',
        signupType: hasEmail && hasMobile ? 'both' : hasEmail ? 'email' : 'mobile'
      }
    };
    
    waitlistUsers.push(user);
    
    console.log(`✅ New user joined: ${hasEmail ? email : 'Mobile user'}, position: ${position}`);
    
    res.json({
      success: true,
      message: hasEmail && hasMobile ? 
        '🎉 Successfully joined waitlist with email & mobile!' :
        hasEmail ? '🎉 Successfully joined waitlist with email!' :
        '🎉 Successfully joined waitlist with mobile!',
      position: user.position,
      referralCode: user.referralCode,
      total: waitlistUsers.length,
      referralLink: `https://dynaprizes.com/?ref=${user.referralCode}`
    });
    
  } catch (error) {
    console.error('Join error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error', 
      details: error.message 
    });
  }
});

// GET STATS (REAL-TIME)
app.get('/api/waitlist/stats', (req, res) => {
  try {
    const total = waitlistUsers.length;
    
    // Today's count
    const today = new Date().toISOString().split('T')[0];
    const todayCount = waitlistUsers.filter(u => 
      u.joinedAt.startsWith(today)
    ).length;
    
    // This week's count (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = waitlistUsers.filter(u => 
      new Date(u.joinedAt) >= weekAgo
    ).length;
    
    // Recent signups (last 10)
    const recent = waitlistUsers
      .slice(-10)
      .reverse()
      .map(u => ({
        email: u.email,
        position: u.position,
        joinedAt: u.joinedAt
      }));
    
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

// ADMIN ENDPOINT - SEE ALL USERS
app.get('/api/waitlist/admin/users', (req, res) => {
  try {
    const users = waitlistUsers
      .slice()
      .reverse() // Newest first
      .map(u => ({
        email: u.email,
        mobile: u.mobile,
        position: u.position,
        referralCode: u.referralCode,
        joinedAt: u.joinedAt,
        metadata: u.metadata
      }));
    
    res.json({ 
      success: true, 
      total: users.length,
      users: users 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Dynaprizes Waitlist API (In-Memory)',
    status: 'fully-functional',
    totalUsers: waitlistUsers.length,
    endpoints: [
      '/health',
      '/test',
      '/api/waitlist/join',
      '/api/waitlist/stats', 
      '/api/waitlist/admin/users'
    ]
  });
});

// Export
module.exports = app;