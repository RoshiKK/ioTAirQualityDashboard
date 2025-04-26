const mongoose = require("mongoose");

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
  },
});

module.exports = mongoose.model("Data", DataSchema);
