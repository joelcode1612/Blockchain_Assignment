const express = require('express');
const router = express.Router();
const escrowController = require('../controllers/depositController');
const { authenticate } = require('../middleware/auth');
// GET /api/escrow/shipper/:agreementId/balance
router.get('/shipper/:agreementId/balance', authenticate, escrowController.viewEscrowBalance);
// POST /api/escrow/shipper/:agreementId/deposit
router.post('/shipper/:agreementId/deposit', authenticate, escrowController.depositEscrow);

module.exports = router;