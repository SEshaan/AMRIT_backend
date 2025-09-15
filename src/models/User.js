import mongoose from 'mongoose';

// Simple User model for future use (currently not needed without authentication)
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    trim: true,
    maxlength: [50, 'Username cannot exceed 50 characters']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  organization: {
    type: String,
    trim: true,
    maxlength: [100, 'Organization name cannot exceed 100 characters']
  },
  role: {
    type: String,
    enum: ['scientist', 'admin', 'researcher'],
    default: 'scientist'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  uploadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

const User = mongoose.model('User', userSchema);

export default User;