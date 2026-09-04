const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }

    cb(null, true);
  },
});

// POST /api/milestones/verify  (body: { agreementId, milestoneId, txHash })
router.post('/verify', authenticate, authorize('Shipper'), milestoneController.verifyMilestone);
router.post(
  '/upload-proof',
  authenticate,
  authorize('Carrier'),
  upload.single('proof'),
  milestoneController.uploadProof
);

module.exports = router;