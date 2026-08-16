const express = require("express");

const router = express.Router();

const agreementController = require("../controllers/agreementController");

const { authenticate, authorize } = require("../middleware/auth");

// =====================================================
// GET ALL AGREEMENTS
// GET /api/agreements
// =====================================================

router.get("/", authenticate, agreementController.getAgreements);

// =====================================================
// GET SINGLE AGREEMENT
// GET /api/agreements/:id
// =====================================================

router.get("/:id", authenticate, agreementController.getAgreement);

// =====================================================
// CREATE AGREEMENT
// POST /api/agreements/create
//
// Shipper creates agreement.
// DOES NOT FUND ESCROW.
// Initial status:
// PendingAcceptance
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
//
// Carrier accepts agreement.
// Status:
// PendingAcceptance → AwaitingFunding
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
//
// Carrier rejects agreement.
// Status:
// PendingAcceptance → Rejected
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
//
// Shipper funds escrow.
// Status:
// AwaitingFunding → Active
// =====================================================

router.post(
  "/:id/fund",
  authenticate,
  authorize("Shipper"),
  agreementController.fundAgreement,
);

module.exports = router;
