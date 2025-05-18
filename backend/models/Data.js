const mongoose = require('mongoose');

const DataSchema = new mongoose.Schema({
  temperature: {
    type: Number,
    min: 0,
    max: 50,
  },
  humidity: {
    type: Number,
    min: 20,
    max: 90,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    unique: true // Prevent duplicate timestamps
  },
  deviceId: {
    type: String,
    required: true
  }
});

// Add compound index to prevent duplicates
DataSchema.index({ timestamp: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('Data', DataSchema);
