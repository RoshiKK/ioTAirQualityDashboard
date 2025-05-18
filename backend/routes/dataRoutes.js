const express = require('express');
const router = express.Router();
const Data = require('../models/Data');
const Firmware = require('../models/Firmware');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

router.post('/', async (req, res) => {
  try {
    const { temperature, humidity, timestamp, deviceId } = req.body;
    
    // Validate data
    if (temperature === undefined || humidity === undefined || !deviceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newData = new Data({
      temperature,
      humidity,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      deviceId
    });

    await newData.save();
    res.status(201).json(newData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login route
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    return res.json({ 
      accessToken: token,
      user: { username }
    });
  }
  
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Get all data
router.get('/', async (req, res) => {
  try {
    const data = await Data.find().sort({ timestamp: -1 }).limit(100);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get historical data
router.get('/history', async (req, res) => {
  try {
    const range = req.query.range || '24h';
    let hours;
    
    switch(range) {
      case '1h': hours = 1; break;
      case '24h': hours = 24; break;
      case '7d': hours = 24*7; break;
      case '30d': hours = 24*30; break;
      default: hours = 24;
    }
    
    const date = new Date(Date.now() - hours * 60 * 60 * 1000);
    const data = await Data.find({ timestamp: { $gte: date } }).sort({ timestamp: 1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Firmware routes
router.get('/firmware/latest', async (req, res) => {
  try {
    const firmware = await Firmware.findOne().sort({ createdAt: -1 });
    if (!firmware) return res.status(404).json({ error: 'No firmware found' });
    res.json(firmware);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/firmware', async (req, res) => {
  try {
    if (!req.files || !req.files.firmware) {
      return res.status(400).json({ error: 'No firmware file uploaded' });
    }
    
    const firmwareFile = req.files.firmware;
    const version = req.body.version;
    const description = req.body.description || '';
    
    // Save to firmware directory
    const uploadDir = path.join(__dirname, '../firmware');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    
    const filePath = path.join(uploadDir, `firmware_v${version}.bin`);
    await firmwareFile.mv(filePath);
    
    // Save to database
    const firmware = new Firmware({
      version,
      description,
      filePath: `/firmware/firmware_v${version}.bin`
    });
    
    await firmware.save();
    res.json({ message: 'Firmware uploaded successfully', firmware });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;