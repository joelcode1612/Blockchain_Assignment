const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5100;

app.use(cors());
app.use(express.json());

// =====================================================
// FIXED PATH CONFIGURATION
// =====================================================
// This creates the perfect absolute path to your public folder
const PUBLIC_DIR = path.join(__dirname, "../frontend", "pages", "public");
const FRONTEND_PAGES_DIR = path.join(__dirname, "../frontend", "pages");
const SHARED_DIR = path.join(__dirname, "../frontend", "pages", "shared");

// Serve root '/' out of the public folder
app.use("/", express.static(PUBLIC_DIR));
app.use("/shared", express.static(SHARED_DIR));

// Other structural static assets
app.use("/abi", express.static(path.join(__dirname, "../abi")));
app.use("/css", express.static(path.join(__dirname, "../frontend/css")));
app.use("/js", express.static(path.join(__dirname, "../frontend/js")));

// Core Routes & Routers
app.get("/api/health", (req, res) => res.json({ status: "OK" }));

const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

// Mount main routes (ensure you updated PAGES_DIR inside this file as shown in step 1!)
const pagesRouter = require("./routes/mainRoutes");
app.use(pagesRouter);

// SPA Dashboard Fallbacks
// NOTE: regex form used so it works on Express 4 AND Express 5
// (Express 5 / path-to-regexp v8 dropped the old "*" wildcard syntax)
app.get(/^\/shipper(?:\/.*)?$/, (req, res) => {
  res.sendFile(path.join(FRONTEND_PAGES_DIR, "shipper/shipper.html"));
});

app.get(/^\/carrier(?:\/.*)?$/, (req, res) => {
  res.sendFile(path.join(FRONTEND_PAGES_DIR, "carrier/carrier.html"));
});

// // 404 Handler
// app.use((req, res) => {
//   res.status(404).sendFile(path.join(SHARED_DIR, "404.html"));
// });

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
