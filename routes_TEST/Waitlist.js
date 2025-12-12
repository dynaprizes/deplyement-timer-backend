const express = require('express');
const router = express.Router();
const WaitlistUser = require('../models/WaitlistUser');
const nodemailer = require('nodemailer');

// FIXED: Email transporter (won't crash if env vars missing)
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('✅ Email transporter configured');
} else {
  console.log('⚠️ Email credentials not set, email sending disabled');
  transporter = null;
}
// Join waitlist
router.post('/join', async (req, res) => {
  try {
    const { email, mobile, referralCode } = req.body; // ADD mobile
    
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
    
    // Create new user WITH mobile
    const user = new WaitlistUser({
      email: email.toLowerCase(),
      mobile: mobile || '', // ADD THIS LINE
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        source: req.body.source || 'website'
      }
    });
    
    // If referred by someone
    if (referralCode) {
      const referrer = await WaitlistUser.findOne({ referralCode });
      if (referrer) {
        user.referredBy = referralCode;
        referrer.referralCount += 1;
        await referrer.save();
      }
    }
    
    await user.save();
    
    // Get total count for position
    const total = await WaitlistUser.countDocuments();
    
    // Send welcome email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🎉 Welcome to Dynaprizes Store Waitlist!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">Welcome to Dynaprizes Store!</h2>
          <p>You're now on the waitlist for the all-in-one shopping app.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3>Your Waitlist Position: <strong>#${user.position}</strong></h3>
            <p>Total people waiting: ${total.toLocaleString()}</p>
          </div>
          <p><strong>Share your referral link to move up:</strong></p>
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; font-family: monospace;">
            https://dynaprizes.com/?ref=${user.referralCode}
          </div>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            We'll notify you when we launch + exclusive early offers.
          </p>
        </div>
      `
    };
    
       // Send welcome email (only if transporter configured)
       if (transporter) {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: '🎉 Welcome to Dynaprizes Store Waitlist!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #f59e0b;">Welcome to Dynaprizes Store!</h2>
              <p>You're now on the waitlist for the all-in-one shopping app.</p>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h3>Your Waitlist Position: <strong>#${user.position}</strong></h3>
                <p>Total people waiting: ${total.toLocaleString()}</p>
              </div>
              <p><strong>Share your referral link to move up:</strong></p>
              <div style="background: #fff3cd; padding: 15px; border-radius: 5px; font-family: monospace;">
                https://dynaprizes.com/?ref=${user.referralCode}
              </div>
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                We'll notify you when we launch + exclusive early offers.
              </p>
            </div>
          `
        };
        
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) console.log('Email error:', error);
        });
      }
    
    res.json({
      success: true,
      message: 'Successfully joined waitlist!',
      position: user.position,
      referralCode: user.referralCode,
      total: total,
      referralLink: `https://dynaprizes.com/?ref=${user.referralCode}`
    });
    
  } catch (error) {
    console.error('Join error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get live stats
router.get('/stats', async (req, res) => {
  try {
    const total = await WaitlistUser.countDocuments();
    
    // Today's count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await WaitlistUser.countDocuments({
      joinedAt: { $gte: today }
    });
    
    // This week's count
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = await WaitlistUser.countDocuments({
      joinedAt: { $gte: weekAgo }
    });
    
    // Recent signups (last 10)
    const recent = await WaitlistUser.find()
      .sort({ joinedAt: -1 })
      .limit(10)
      .select('email position joinedAt -_id');
    
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

// Get user position by referral code
router.get('/user/:referralCode', async (req, res) => {
  try {
    const user = await WaitlistUser.findOne({ 
      referralCode: req.params.referralCode 
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      position: user.position,
      referralCount: user.referralCount,
      joinedAt: user.joinedAt,
      referralCode: user.referralCode
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leaderboard (top referrers)
router.get('/leaderboard', async (req, res) => {
  try {
    const leaders = await WaitlistUser.find({ referralCount: { $gt: 0 } })
      .sort({ referralCount: -1 })
      .limit(20)
      .select('email referralCount position -_id');
    
    res.json({ leaders });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
// ADD THIS CODE BEFORE THE LAST LINE:

// Admin endpoint - get all users
router.get('/admin/users', async (req, res) => {
  try {
    const users = await WaitlistUser.find()
      .sort({ joinedAt: -1 })
      .select('email mobile position referralCode joinedAt -_id');
    
    res.json({ 
      success: true, 
      total: users.length,
      users: users 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Make sure this line is BELOW your new code
module.exports = router;
