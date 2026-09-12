const express = require("express");
const router = express.Router();
const historyController = require("../controllers/historyController");
const { authenticate } = require("../middleware/authMiddleware");

// GET /api/history – all agreements for the user
router.get("/", authenticate, historyController.getAllHistory);

// GET /api/history/:agreementId – specific agreement
router.get("/:agreementId", authenticate, historyController.getHistory);

module.exports = router;
