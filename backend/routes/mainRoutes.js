const express = require("express");
const path = require("path");

const router = express.Router();

// =====================================================
// MODULE ROUTES
// =====================================================

const authRoutes = require("./authRoutes");
const agreementRoutes = require("./agreementRoutes");
const userRoutes = require("./userRoutes");
const shipperRoutes = require("./shipperRoutes");
const carrierRoutes = require("./carrierRoutes");
const transactionRoutes = require("./transactionRoutes");
const paymentRoutes = require('./paymentRoutes');
const milestoneRoutes = require('./milestoneRoutes');
const historyRoutes = require('./historyRoutes');   
const depositRoutes = require('./depositRoutes');   

const PAGES_DIR = path.join(__dirname, "../../frontend/pages");

// =====================================================
// LANDING PAGE
// =====================================================
router.get("/", (req, res) => {
  res.sendFile(path.join(PAGES_DIR, "public/index.html"));
});

// =====================================================
// STATIC SHARED PAGES
// =====================================================
router.use('/shared', express.static(path.join(__dirname, '../../frontend/pages/shared')));

// Also serve history.html directly at the root
router.get('/history.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/pages/shared/history.html'));
});

// =====================================================
// API ROUTES
// =====================================================
router.use("/api/auth", authRoutes);
router.use("/api/agreements", agreementRoutes);
router.use("/api/users", userRoutes);

// ✅ FIXED: changed app.use → router.use
router.use('/api/payment', paymentRoutes);
router.use('/api/milestones', milestoneRoutes);
router.use('/api/history', historyRoutes);
router.use('/api/deposit', depositRoutes);

// =====================================================
// FRONTEND PAGE ROUTES
// =====================================================
router.use("/", shipperRoutes);
router.use("/", carrierRoutes);
router.use("/", transactionRoutes);

module.exports = router;