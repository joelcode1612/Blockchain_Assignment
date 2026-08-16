const express = require("express");
const path = require("path");

const router = express.Router();

// =====================================================
// MODULE ROUTES
// =====================================================

const authRoutes = require("./authRoutes");
const agreementRoutes = require("./agreementRoutes");
const userRoutes = require("./userRoutes");
const escrowRoutes = require("./escrowRoutes");
const shipperRoutes = require("./shipperRoutes");
const carrierRoutes = require("./carrierRoutes");
const transactionRoutes = require("./transactionRoutes");

// Add these later when the files are created
// const milestoneRoutes = require("./milestoneRoutes");
// const paymentRoutes = require("./paymentRoutes");

const PAGES_DIR = path.join(__dirname, "../../frontend/pages");

// =====================================================
// LANDING PAGE
// =====================================================

router.get("/", (req, res) => {
  res.sendFile(path.join(PAGES_DIR, "public/index.html"));
});

// =====================================================
// API ROUTES
// =====================================================

router.use("/api/auth", authRoutes);

router.use("/api/agreements", agreementRoutes);

router.use("/api/users", userRoutes);

// Later:
// router.use("/api/milestones", milestoneRoutes);
// router.use("/api/payments", paymentRoutes);

// =====================================================
// FRONTEND PAGE ROUTES
// =====================================================

router.use("/", escrowRoutes);

router.use("/", shipperRoutes);

router.use("/", carrierRoutes);

router.use("/", transactionRoutes);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;
