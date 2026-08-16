const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/milestones/:agreementId/milestone/:milestoneId/verify
router.post('/:agreementId/milestone/:milestoneId/verify', authenticate, authorize('shipper'), milestoneController.verifyMilestone);
router.post('/', authenticate, authorize('shipper'), milestoneController.verifyMilestone);

module.exports = router;