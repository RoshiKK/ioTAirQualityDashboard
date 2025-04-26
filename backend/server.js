require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dataRoutes = require("./routes/dataRoutes");
const path = require("path");

const app = express();

app.use(express.json());
app.use(cors({
  origin: ["http://localhost:3000", "http://192.168.100.22:3000"], // Allow both
  methods: ["GET", "POST"]
}));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB Connected"))
.catch(err => console.error("MongoDB Connection Error:", err));

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB Disconnected!");
});

app.use("/api/data", dataRoutes);
app.use('/firmware', express.static(path.join(__dirname, 'firmware')));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
