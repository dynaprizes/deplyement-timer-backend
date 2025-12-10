require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const waitlistRoutes = require('./routes/waitlist');

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:3000'],
  credentials: true
}));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Error:', err));

// Routes
app.use('/api/waitlist', waitlistRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    count: 'Live count from DB' // You'll update this
  });
});

// Kinsta-style stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const WaitlistUser = require('./models/WaitlistUser');
    const total = await WaitlistUser.countDocuments();
    
    // Get today's count (last 24 hours)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await WaitlistUser.countDocuments({
      joinedAt: { $gte: today }
    });
    
    // Get this week's count
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = await WaitlistUser.countDocuments({
      joinedAt: { $gte: weekAgo }
    });
    
    res.json({
      total,
      today: todayCount,
      week: weekCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
});