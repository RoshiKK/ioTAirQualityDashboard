const router = require("express").Router();
const Data = require("../models/Data");
const Firmware = require("../models/Firmware"); // We'll create this model
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for firmware uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../firmware');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `firmware-${Date.now()}.bin`);
  }
});

const upload = multer({ storage });

// POST route to save data
router.post("/", async (req, res) => {
  try {
    const { temperature, humidity } = req.body;
    const newData = new Data({ temperature, humidity });
    await newData.save();
    res.status(201).json(newData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET route to fetch latest 30 entries
router.get("/", async (req, res) => {
  try {
    const data = await Data.find().sort({ timestamp: -1 }).limit(30);
    res.json(data); // Removed the reverse() - we want newest first
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET route for historical data
router.get("/history", async (req, res) => {
  try {
    const { range } = req.query;
    let dateFilter = new Date();
    
    if (range === 'day') {
      dateFilter.setDate(dateFilter.getDate() - 1);
    } else if (range === 'week') {
      dateFilter.setDate(dateFilter.getDate() - 7);
    }
    
    const data = await Data.find({
      timestamp: { $gte: dateFilter }
    }).sort({ timestamp: 1 }); // Oldest first for historical data
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/firmware", upload.single('firmware'), async (req, res) => {
  try {
    const { version, description } = req.body;
    const filePath = req.file.path;
    
    const newFirmware = new Firmware({
      version,
      description,
      filePath,
      createdAt: new Date()
    });
    
    await newFirmware.save();
    res.status(201).json(newFirmware);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/firmware/latest", async (req, res) => {
  try {
    const firmware = await Firmware.findOne().sort({ createdAt: -1 });
    if (!firmware) {
      return res.status(404).json({ error: "No firmware available" });
    }
    
    res.json({
      version: firmware.version,
      url: `${req.protocol}://${req.get('host')}/firmware/${firmware._id}/download`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/firmware/:id/download", async (req, res) => {
  try {
    const firmware = await Firmware.findById(req.params.id);
    if (!firmware) {
      return res.status(404).json({ error: "Firmware not found" });
    }
    
    res.download(firmware.filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;