const mongoose = require('mongoose');

const waitlistUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  referralCode: {
    type: String,
    unique: true,
    default: () => 'DYN' + Math.random().toString(36).substr(2, 6).toUpperCase()
  },
  referredBy: {
    type: String,
    default: null
  },
  position: {
    type: Number,
    default: 0
  },
  referralCount: {
    type: Number,
    default: 0
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  metadata: {
    ip: String,
    userAgent: String,
    source: {
      type: String,
      default: 'website'
    }
  }
});

// Auto-increment position
waitlistUserSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('WaitlistUser').countDocuments();
    this.position = count + 1;
  }
  next();
});

module.exports = mongoose.model('WaitlistUser', waitlistUserSchema);