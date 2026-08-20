// require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pagesPath = path.join(__dirname, "../frontend/pages");    

app.use(express.static(pagesPath));
app.use("/abi", express.static(path.join(__dirname, "../abi")));
app.use("/css", express.static(path.join(__dirname, "../frontend/css")));
app.use("/js", express.static(path.join(__dirname, "../frontend/js")));

app.get("/api/health", (req, res) => res.json({ status: "OK" }));

const pagesRouter = require("./routes/mainRoutes");
// Mount the page router (may handle /login, /register, etc.)
app.use(pagesRouter);

// ==== SPA FALLBACKS ====
// For shipper routes – adjust the file path to match your actual location
app.get('/shipper/*', (req, res) => {
  // Example: if shipper.html is inside pages/shipper/
  res.sendFile(path.join(pagesPath, 'shipper/shipper.html'));
});

// For carrier routes
app.get('/carrier/*', (req, res) => {
  res.sendFile(path.join(pagesPath, 'carrier/carrier.html'));
});

// =====================================================
// 404 HANDLER – catches all unmatched routes
// =====================================================
// router.use((req, res) => {
//   const errorPagePath = path.join(PAGES_DIR, "shared", "404.html");
//   res.status(404).sendFile(errorPagePath);
// });

// Optional global fallback – but be careful not to catch API routes.
// If you have a root index.html (e.g., landing page) inside pages/public/, serve that.
// app.get('*', (req, res) => {
//   res.sendFile(path.join(pagesPath, 'public/index.html'));
// });

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
