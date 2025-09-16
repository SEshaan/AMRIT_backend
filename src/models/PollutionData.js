import mongoose from 'mongoose';

const pollutionDataSchema = new mongoose.Schema({
  // Core location information
  location: {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
      maxlength: [200, 'Location name cannot exceed 200 characters']
    },
    state: {
      type: String,
      trim: true,
      maxlength: [100, 'State name cannot exceed 100 characters']
    },
    district: {
      type: String,
      trim: true,
      maxlength: [100, 'District name cannot exceed 100 characters']
    }
  },
  
  // Coordinates in GeoJSON format for accurate geospatial operations
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude] - Note: MongoDB uses [lon, lat] order
      required: [true, 'Coordinates are required'],
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Coordinates must be [longitude, latitude] with valid ranges'
      }
    }
  },

  // Legacy coordinate fields for easy access (virtual fields)
  latitude: {
    type: Number,
    get: function() {
      return this.coordinates?.coordinates?.[1];
    }
  },
  longitude: {
    type: Number,
    get: function() {
      return this.coordinates?.coordinates?.[0];
    }
  },

  // Sample information
  sampleInfo: {
    year: {
      type: Number,
      required: [true, 'Sample year is required'],
      min: [1900, 'Year must be after 1900'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the future']
    },
    serialNumber: {
      type: String,
      trim: true
    }
  },

  // Flexible heavy metal values - using Map for dynamic keys
  heavyMetals: {
    type: Map,
    of: {
      value: {
        type: Number,
        min: [0, 'Heavy metal value must be non-negative']
      },
      unit: {
        type: String,
        enum: ['ppm', 'ppb', 'mg/L', 'μg/L'],
        default: 'ppm'
      }
    }
  },

  // Other environmental parameters (flexible)
  environmentalParams: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // Computed pollution indices
  pollutionIndices: {
    hmpi: {
      value: {
        type: Number,
        min: [0, 'HMPI value must be non-negative']
      },
      category: {
        type: String,
        enum: ['Safe', 'Mid', 'Unsafe', 'Unknown'],
        default: 'Unknown'
      },
      calculatedAt: {
        type: Date,
        default: Date.now
      }
    },
    customIndices: {
      type: Map,
      of: {
        value: Number,
        category: String,
        calculatedAt: Date
      }
    }
  },

  // Original input data (for reference)
  originalData: {
    type: mongoose.Schema.Types.Mixed
  },

  // Processing metadata
  processing: {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // Made optional since we don't have user authentication
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    fileName: {
      type: String,
      trim: true
    },
    fileHash: {
      type: String,
      trim: true
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending'
    },
    processingErrors: [{
      field: String,
      message: String,
      timestamp: { type: Date, default: Date.now }
    }],
    lastCalculated: {
      type: Date
    }
  },

  // Quality control flags
  qualityFlags: {
    isValidated: {
      type: Boolean,
      default: false
    },
    hasAnomalies: {
      type: Boolean,
      default: false
    },
    anomalies: [String],
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    }
  }
}, {
  timestamps: true,
  // Enable strict mode but allow additional fields
  strict: false
});

// Indexes for performance
pollutionDataSchema.index({ 'location.name': 1 });
pollutionDataSchema.index({ 'location.state': 1 });
pollutionDataSchema.index({ 'sampleInfo.year': 1 });
pollutionDataSchema.index({ 'processing.uploadedBy': 1 });
pollutionDataSchema.index({ 'processing.uploadedAt': 1 });
pollutionDataSchema.index({ 'pollutionIndices.hmpi.category': 1 });
pollutionDataSchema.index({ 'processing.processingStatus': 1 });

// Proper GeoJSON 2dsphere index for accurate geospatial queries
pollutionDataSchema.index({ coordinates: '2dsphere' });

// Method to add heavy metal value
pollutionDataSchema.methods.addHeavyMetal = function(metal, value, unit = 'ppm') {
  if (!this.heavyMetals) {
    this.heavyMetals = new Map();
  }
  this.heavyMetals.set(metal.toUpperCase(), { value, unit });
  return this;
};

// Method to get heavy metal value
pollutionDataSchema.methods.getHeavyMetal = function(metal) {
  return this.heavyMetals ? this.heavyMetals.get(metal.toUpperCase()) : null;
};

// Method to update HMPI calculation
pollutionDataSchema.methods.updateHMPI = function(value, category) {
  this.pollutionIndices.hmpi = {
    value,
    category,
    calculatedAt: new Date()
  };
  this.processing.lastCalculated = new Date();
  this.processing.processingStatus = 'processed';
  return this;
};

// Method to add processing error
pollutionDataSchema.methods.addProcessingError = function(field, message) {
  this.processing.processingErrors.push({
    field,
    message,
    timestamp: new Date()
  });
  return this;
};

// Static method to find by location
pollutionDataSchema.statics.findByLocation = function(locationName, state = null) {
  const query = { 'location.name': new RegExp(locationName, 'i') };
  if (state) {
    query['location.state'] = new RegExp(state, 'i');
  }
  return this.find(query);
};

// Static method to find by coordinates (within radius)
pollutionDataSchema.statics.findNearCoordinates = function(latitude, longitude, radiusInKm = 10) {
  return this.find({
    coordinates: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusInKm * 1000 // Convert km to meters
      }
    }
  });
};

// Static method to get pollution statistics
pollutionDataSchema.statics.getPollutionStats = function(filters = {}) {
  const pipeline = [
    { $match: filters },
    {
      $group: {
        _id: '$pollutionIndices.hmpi.category',
        count: { $sum: 1 },
        avgHMPI: { $avg: '$pollutionIndices.hmpi.value' },
        minHMPI: { $min: '$pollutionIndices.hmpi.value' },
        maxHMPI: { $max: '$pollutionIndices.hmpi.value' }
      }
    }
  ];
  return this.aggregate(pipeline);
};

const PollutionData = mongoose.model('PollutionData', pollutionDataSchema);

export default PollutionData;