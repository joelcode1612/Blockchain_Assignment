const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authenticate } = require("../middleware/authMiddleware");

// ═══ YON — SECURITY ═══
const { verifyTransaction } = require("../middleware/verifyTx");
// ═══ YON End ═══

// POST /api/payment/release
// ═══ YON — SECURITY: added verifyTransaction ═══
router.post(
  "/release",
  authenticate,
  verifyTransaction,
  paymentController.recordPaymentRelease,
);
// ═══ YON End ═══

module.exports = router;
