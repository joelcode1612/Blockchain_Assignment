const express = require('express');
const router = express.Router();
const escrowController = require('../controllers/escrowController');
const { authenticate } = require('../middleware/auth');

// GET /api/escrow/:agreementId/balance
router.get('/:agreementId/balance', authenticate, escrowController.viewEscrowBalance);

// POST /api/escrow/:agreementId/deposit
router.post('/:agreementId/deposit', authenticate, escrowController.depositEscrow);

module.exports = router;