import mongoose from 'mongoose';

const heavyMetalStandardSchema = new mongoose.Schema({
  metal: {
    type: String,
    required: [true, 'Metal name is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  standardValue: {
    type: Number,
    required: [true, 'Standard value is required'],
    min: [0, 'Standard value must be positive']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    enum: ['ppm', 'ppb', 'mg/L', 'μg/L'],
    trim: true
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    trim: true,
    maxlength: [200, 'Source cannot exceed 200 characters']
  },
  category: {
    type: String,
    enum: ['WHO', 'EPA', 'BIS', 'CPCB', 'Custom'],
    default: 'WHO'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for performance (metal index removed since unique: true already creates it)
heavyMetalStandardSchema.index({ isActive: 1 });

// Method to update standard value
heavyMetalStandardSchema.methods.updateStandard = function(newValue, updatedBy) {
  this.standardValue = newValue;
  this.lastUpdated = new Date();
  this.updatedBy = updatedBy;
  return this.save();
};

// Static method to get all active standards
heavyMetalStandardSchema.statics.getActiveStandards = function() {
  return this.find({ isActive: true }).select('metal standardValue unit');
};

// Static method to get standard for specific metal
heavyMetalStandardSchema.statics.getStandardForMetal = function(metal) {
  return this.findOne({ 
    metal: metal.toUpperCase(), 
    isActive: true 
  }).select('metal standardValue unit');
};

const HeavyMetalStandard = mongoose.model('HeavyMetalStandard', heavyMetalStandardSchema);

export default HeavyMetalStandard;