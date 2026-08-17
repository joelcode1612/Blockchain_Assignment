const express = require("express");
const router = express.Router();
const agreementController = require("../controllers/agreementController");
const { authenticate, authorize } = require("../middleware/auth");

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
router.post(
  "/create",
  authenticate,
  authorize("Shipper"),
  agreementController.createAgreement,
);

// =====================================================
// ACCEPT AGREEMENT
// POST /api/agreements/:id/accept
// =====================================================
router.post(
  "/:id/accept",
  authenticate,
  authorize("Carrier"),
  agreementController.acceptAgreement,
);

// =====================================================
// REJECT AGREEMENT
// POST /api/agreements/:id/reject
// =====================================================
router.post(
  "/:id/reject",
  authenticate,
  authorize("Carrier"),
  agreementController.rejectAgreement,
);

// =====================================================
// FUND AGREEMENT
// POST /api/agreements/:id/fund
// =====================================================
router.post(
  "/:id/fund",
  authenticate,
  authorize("Shipper"),
  agreementController.fundAgreement,
);

module.exports = router;
