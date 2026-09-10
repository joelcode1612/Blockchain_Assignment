const express = require("express");
const router = express.Router();
const agreementController = require("../controllers/agreementController");
const { authenticate, authorize } = require("../middleware/auth");

// ═══ YON — SECURITY ═══
const { verifyTransaction } = require("../middleware/verifyTx");
// ═══ YON End ═══

// =====================================================
// GET ALL AGREEMENTS
// GET /api/agreements
// =====================================================
router.get("/", authenticate, agreementController.getAgreements);

// ✅ NEW: GET AVAILABLE AGREEMENTS
// GET /api/agreements/available
// This must come BEFORE the /:id route
// =====================================================
router.get(
  "/available",
  authenticate,
  agreementController.getAvailableAgreements,
);

// =====================================================
// GET SINGLE AGREEMENT
// GET /api/agreements/:id
// =====================================================
router.get("/:id", authenticate, agreementController.getAgreement);

// =====================================================
// CREATE AGREEMENT
// POST /api/agreements/create
// =====================================================
// ═══ YON — SECURITY: added verifyTransaction ═══
router.post(
  "/create",
  authenticate,
  verifyTransaction,
  authorize("Shipper"),
  agreementController.createAgreement,
);
// ═══ YON End ═══

// =====================================================
// ACCEPT AGREEMENT
// POST /api/agreements/:id/accept
// =====================================================
// ═══ YON — SECURITY: added verifyTransaction ═══
router.post(
  "/:id/accept",
  authenticate,
  verifyTransaction,
  authorize("Carrier"),
  agreementController.acceptAgreement,
);
// ═══ YON End ═══

// =====================================================
// REJECT AGREEMENT
// POST /api/agreements/:id/reject
// =====================================================
// ═══ YON — SECURITY: added verifyTransaction ═══
router.post(
  "/:id/reject",
  authenticate,
  verifyTransaction,
  authorize("Carrier"),
  agreementController.rejectAgreement,
);
// ═══ YON End ═══

// =====================================================
// FUND AGREEMENT
// POST /api/agreements/:id/fund
// =====================================================
// ═══ YON — SECURITY: added verifyTransaction ═══
router.post(
  "/:id/fund",
  authenticate,
  verifyTransaction,
  authorize("Shipper"),
  agreementController.fundAgreement,
);
// ═══ YON End ═══

module.exports = router;
