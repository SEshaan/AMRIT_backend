import mongoose from 'mongoose';

const formulaConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Formula name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Formula name cannot exceed 100 characters']
  },
  type: {
    type: String,
    required: [true, 'Formula type is required'],
    enum: ['HMPI', 'contamination_factor', 'pollution_index', 'custom'],
    default: 'HMPI'
  },
  formula: {
    type: String,
    required: [true, 'Formula expression is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Formula description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  variables: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    unit: {
      type: String,
      trim: true
    }
  }],
  thresholds: {
    safe: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 30 }
    },
    mid: {
      min: { type: Number, default: 30 },
      max: { type: Number, default: 100 }
    },
    unsafe: {
      min: { type: Number, default: 100 },
      max: { type: Number, default: Infinity }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: String,
    default: '1.0.0'
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

// Index for performance (name index removed since unique: true already creates it)
formulaConfigSchema.index({ type: 1 });
formulaConfigSchema.index({ isActive: 1 });

// Method to categorize value based on thresholds
formulaConfigSchema.methods.categorizeValue = function(value) {
  if (value >= this.thresholds.safe.min && value < this.thresholds.safe.max) {
    return 'Safe';
  } else if (value >= this.thresholds.mid.min && value < this.thresholds.mid.max) {
    return 'Mid';
  } else if (value >= this.thresholds.unsafe.min) {
    return 'Unsafe';
  }
  return 'Unknown';
};

// Method to update formula
formulaConfigSchema.methods.updateFormula = function(newFormula, updatedBy) {
  this.formula = newFormula;
  this.lastUpdated = new Date();
  this.updatedBy = updatedBy;
  return this.save();
};

// Static method to get active formula by type
formulaConfigSchema.statics.getActiveFormulaByType = function(type) {
  return this.findOne({ type, isActive: true });
};

// Static method to get HMPI formula
formulaConfigSchema.statics.getHMPIFormula = function() {
  return this.findOne({ type: 'HMPI', isActive: true });
};

const FormulaConfig = mongoose.model('FormulaConfig', formulaConfigSchema);

export default FormulaConfig;