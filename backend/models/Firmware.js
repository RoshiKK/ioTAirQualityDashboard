const mongoose = require("mongoose");

const FirmwareSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  filePath: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Firmware", FirmwareSchema);