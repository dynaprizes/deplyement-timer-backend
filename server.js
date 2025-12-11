require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Simple test schema
const WaitlistUser = mongoose.model('WaitlistUser', new mongoose.Schema({
  email: String,
  position: Number,
  joinedAt: { type: Date, default: Date.now }
}));

// Health check with DB status
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

// Waitlist endpoints
app.post('/api/waitlist/join', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    const count = await WaitlistUser.countDocuments();
    const position = count + 1;
    
    const user = new WaitlistUser({ email, position });
    await user.save();
    
    res.json({
      success: true,
      message: 'Joined waitlist!',
      position: position,
      total: position
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/waitlist/stats', async (req, res) => {
  try {
    const total = await WaitlistUser.countDocuments();
    res.json({ total, today: 0, week: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: 'Dynaprizes Waitlist API',
    endpoints: ['/health', '/api/waitlist/join', '/api/waitlist/stats']
  });
});

// Export for Vercel
module.exports = app;