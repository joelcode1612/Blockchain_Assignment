const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5100;

app.use(cors());
app.use(express.json());

// ─── Paths ──────────────────────────────────────────────
const FRONTEND_PAGES_DIR = path.join(__dirname, "../frontend", "pages");
const PUBLIC_DIR = path.join(FRONTEND_PAGES_DIR, "public");
const SHARED_DIR = path.join(FRONTEND_PAGES_DIR, "shared");

// ─── Public & shared (no role required) ──────────────
app.use("/", express.static(PUBLIC_DIR)); // serves index.html, login.html, register.html
app.use("/shared", express.static(SHARED_DIR));

// ─── Fragments (SPA content) – ADD THIS ──────────────
app.use("/fragments", express.static(FRONTEND_PAGES_DIR));

// ─── Other assets ──────────────────────────────────────
app.use("/abi", express.static(path.join(__dirname, "../abi")));
app.use("/css", express.static(path.join(__dirname, "../frontend/css")));
app.use("/js", express.static(path.join(__dirname, "../frontend/js")));

// ─── API routes ─────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "OK" }));
const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

// ─── Main routes (login, register, etc.) ──────────────
const pagesRouter = require("./routes/mainRoutes");
app.use(pagesRouter);

// ─── SPA fallbacks (serve the shell HTML) ─────────────
app.get(/^\/shipper(?:\/.*)?$/, (req, res) => {
  res.sendFile(path.join(FRONTEND_PAGES_DIR, "shipper/shipper_dashboard.html"));
});
app.get(/^\/carrier(?:\/.*)?$/, (req, res) => {
  res.sendFile(path.join(FRONTEND_PAGES_DIR, "carrier/carrier_dashboard.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
