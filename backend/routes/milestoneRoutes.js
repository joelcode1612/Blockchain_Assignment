const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/milestones/verify  (body: { agreementId, milestoneId, txHash })
router.post('/verify', authenticate, authorize('Shipper'), milestoneController.verifyMilestone);

module.exports = router;