const express = require("express");
const path = require("path");

const router = express.Router();

// =====================================================
// MIDDLEWARE
// =====================================================
const { authenticate, authorize } = require("../middleware/auth");

// =====================================================
// MODULE ROUTES
// =====================================================
const authRoutes = require("./authRoutes");
const agreementRoutes = require("./agreementRoutes");
const userRoutes = require("./userRoutes");
const shipperRoutes = require("./shipperRoutes");
const carrierRoutes = require("./carrierRoutes");
const transactionRoutes = require("./transactionRoutes");
const paymentRoutes = require("./paymentRoutes");
const milestoneRoutes = require("./milestoneRoutes");
const historyRoutes = require("./historyRoutes");
const depositRoutes = require("./depositRoutes");

const PAGES_DIR = path.join(__dirname, "../../frontend/pages");

// =====================================================
// PUBLIC ROUTES (no authentication required)
// =====================================================

// Landing page
router.get("/", (req, res) => {
  res.sendFile(path.join(PAGES_DIR, "public/index.html"));
});

// Unified Connect Wallet Page (replaces login/register)
router.get("/connect.html", (req, res) => {
  res.sendFile(path.join(PAGES_DIR, "public/connect.html"));
});

// Optional: Add a clean URL alias so /connect also works
router.get("/connect", (req, res) => {
  res.sendFile(path.join(PAGES_DIR, "public/connect.html"));
});

// Static shared pages
router.use(
  "/shared",
  express.static(path.join(__dirname, "../../frontend/pages/shared")),
);
router.get("/history.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../frontend/pages/shared/history.html"),
  );
});

// Auth routes (login/register endpoints) – public
router.use("/api/auth", authRoutes);

router.use("/api/agreements", agreementRoutes);
router.use("/api/users", userRoutes);
router.use("/api/payment", paymentRoutes);
router.use("/api/milestones", milestoneRoutes);
router.use("/api/history", historyRoutes);
router.use("/api/escrow", depositRoutes);

// ═══ YON — REPUTATION MODULE ═══
const reputationRoutes = require("./reputationRoutes");
router.use("/api/reputation", reputationRoutes);
// ═══ YON End ═══

// =====================================================
// FRONTEND PAGE ROUTES (public – they will call protected APIs)
// =====================================================
router.use("/", shipperRoutes);
router.use("/", carrierRoutes);
router.use("/", transactionRoutes);

// =====================================================
// 404 HANDLER – catches all unmatched routes
// =====================================================
// router.use((req, res) => {
//   const errorPagePath = path.join(PAGES_DIR, "shared", "404.html");
//   res.status(404).sendFile(errorPagePath);
// });

module.exports = router;
