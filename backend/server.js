require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const staticPath = path.join(__dirname, "../frontend");
app.use(express.static(staticPath));
app.use("/abi", express.static(path.join(__dirname, "../abi")));

// Serve static assets (CSS and JS) from their respective folders
app.use("/css", express.static(path.join(__dirname, "../frontend/css")));
app.use("/js", express.static(path.join(__dirname, "../frontend/js")));

// Page router — maps clean URLs to the existing page files
const pagesRouter = require("./routes/mainRoutes");
app.use(pagesRouter);

// API health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server running" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
