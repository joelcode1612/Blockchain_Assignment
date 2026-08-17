const agreementService = require("../services/agreementService");

// =====================================================
// GET ALL AGREEMENTS
// =====================================================

exports.getAgreements = async (req, res) => {
  try {
    const agreements = await agreementService.getAllAgreements();

    res.json(agreements);
  } catch (error) {
    console.error("Get agreements error:", error);

    res.status(500).json({
      error: "Failed to fetch agreements",
    });
  }
};

// =====================================================
// GET SINGLE AGREEMENT
// =====================================================

exports.getAgreement = async (req, res) => {
  try {
    const agreementId = req.params.id;

    const agreement = await agreementService.getAgreementById(agreementId);

    if (!agreement) {
      return res.status(404).json({
        error: "Agreement not found",
      });
    }

    res.json(agreement);
  } catch (error) {
    console.error("Get agreement error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// =====================================================
// CREATE AGREEMENT
// POST /api/agreements/create
//
// Does NOT fund escrow.
// =====================================================

exports.createAgreement = async (req, res) => {
  try {
    const {
      onchainId,
      carrier,
      totalAmountEth,
      descriptions,
      percentages,
      deadlineTimestamp,
      createTx,
    } = req.body;

    const shipperAddress = req.user.wallet_address;

    // ---------------------------------------------
    // Validate
    // ---------------------------------------------

    if (
      onchainId === undefined ||
      !carrier ||
      !totalAmountEth ||
      !descriptions ||
      !percentages ||
      !deadlineTimestamp ||
      !createTx
    ) {
      return res.status(400).json({
        error: "Missing required agreement information",
      });
    }

    // ---------------------------------------------
    // Create database record
    // ---------------------------------------------

    const result = await agreementService.createAgreement({
      onchainId,

      shipperAddress,

      carrierAddress: carrier,

      totalAmountEth,

      deadlineTimestamp,

      descriptions,

      percentages,

      createTx,
    });

    res.status(201).json({
      message:
        "Agreement created successfully. Waiting for carrier acceptance.",

      agreementId: result.agreementId,

      status: "PendingAcceptance",

      createTx: result.createTx,
    });
  } catch (error) {
    console.error("Create agreement error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// =====================================================
// ACCEPT AGREEMENT
// =====================================================

exports.acceptAgreement = async (req, res) => {
  try {
    const agreementId = req.params.id;

    const { acceptTx } = req.body;

    const carrierAddress = req.user.wallet_address;

    if (!acceptTx) {
      return res.status(400).json({
        error: "Blockchain acceptance transaction is required",
      });
    }

    const result = await agreementService.acceptAgreement(
      agreementId,
      carrierAddress,
      acceptTx,
    );

    res.json({
      message: "Agreement accepted. Waiting for shipper funding.",

      agreementId,

      status: "AwaitingFunding",

      acceptTx: result.acceptTx,
    });
  } catch (error) {
    console.error("Accept agreement error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// =====================================================
// REJECT AGREEMENT
// =====================================================

exports.rejectAgreement = async (req, res) => {
  try {
    const agreementId = req.params.id;

    const { rejectTx } = req.body;

    const carrierAddress = req.user.wallet_address;

    if (!rejectTx) {
      return res.status(400).json({
        error: "Blockchain rejection transaction is required",
      });
    }

    const result = await agreementService.rejectAgreement(
      agreementId,
      carrierAddress,
      rejectTx,
    );

    res.json({
      message: "Agreement rejected",

      agreementId,

      status: "Rejected",

      rejectTx: result.rejectTx,
    });
  } catch (error) {
    console.error("Reject agreement error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// =====================================================
// FUND AGREEMENT
// =====================================================

exports.fundAgreement = async (req, res) => {
  try {
    const agreementId = req.params.id;

    const { fundTx } = req.body;

    const shipperAddress = req.user.wallet_address;

    if (!fundTx) {
      return res.status(400).json({
        error: "Blockchain funding transaction is required",
      });
    }

    const result = await agreementService.fundAgreement(
      agreementId,
      shipperAddress,
      fundTx,
    );

    res.json({
      message: "Escrow funded successfully. Agreement is now active.",

      agreementId,

      status: "Active",

      fundTx: result.fundTx,
    });
  } catch (error) {
    console.error("Fund agreement error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// =====================================================
// GET ALL CARRIERS
// GET /api/users/carriers
// =====================================================

exports.getCarriers = async (req, res) => {
  try {
    const carriers = await userModel.findAllCarriers();

    res.json(carriers);
  } catch (error) {
    console.error("Get carriers error:", error);

    res.status(500).json({
      error: "Failed to fetch carriers",
    });
  }
};