require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dataRoutes = require("./routes/dataRoutes");
const path = require("path");
const fileUpload = require('express-fileupload');

const app = express();

app.use(fileUpload());
app.use(express.json());
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB Connected"))
.catch(err => {
  console.error("MongoDB Connection Error:", err);
  process.exit(1);
});

app.use("/api/data", (req, res, next) => {
  // Skip authentication for GET requests and login route
  if (req.method === "GET" || req.path === "/login") return next();
  
  // Allow POST requests from ESP32
  if (req.method === "POST") {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token || token !== process.env.DEVICE_TOKEN) {
      return res.status(401).json({ error: "Unauthorized device" });
    }
    return next();
  }
  
  // For all other methods, require JWT auth
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
});

// Mount data routes only once
app.use("/api/data", dataRoutes);
app.use('/api/data/firmware', express.static(path.join(__dirname, 'firmware')));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));