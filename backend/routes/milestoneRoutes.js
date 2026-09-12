const express = require("express");
const router = express.Router();
const milestoneController = require("../controllers/milestoneController");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const multer = require("multer");

// ═══ YON — SECURITY ═══
const { verifyTransaction } = require("../middleware/verifyTx");
// ═══ YON End ═══

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  },
});

// POST /api/milestones/verify  (body: { agreementId, milestoneId, txHash })
// ═══ YON — SECURITY: added verifyTransaction ═══
router.post(
  "/verify",
  authenticate,
  verifyTransaction,
  authorize("Shipper"),
  milestoneController.verifyMilestone,
);
// ═══ YON End ═══
router.post(
  "/upload-proof",
  authenticate,
  authorize("Carrier"),
  upload.single("proof"),
  milestoneController.uploadProof,
);

module.exports = router;
