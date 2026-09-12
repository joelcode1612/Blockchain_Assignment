// ═══ YON — REPUTATION MODULE ═══
const express = require("express");
const router = express.Router();
const reputationController = require("../controllers/reputationController");
const { authenticate } = require("../middleware/authMiddleware");

// GET /api/reputation/me — current user's reputation token balance
router.get("/me", authenticate, reputationController.getMyReputation);

// GET /api/reputation/history — current user's reputation reward history
router.get(
  "/history",
  authenticate,
  reputationController.getMyReputationHistory,
);

module.exports = router;
// ═══ YON End ═══
