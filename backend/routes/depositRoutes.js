const express = require('express');
const router = express.Router();
const escrowController = require('../controllers/depositController');
const { authenticate } = require('../middleware/auth');

// ═══ YON — SECURITY & HISTORY ═══
const { verifyTransaction } = require('../middleware/verifyTx');
const refundController = require('../controllers/refundController');
// ═══ YON End ═══

// GET /api/escrow/shipper/:agreementId/balance
router.get('/shipper/:agreementId/balance', authenticate, escrowController.viewEscrowBalance);

// POST /api/escrow/shipper/:agreementId/deposit
// ═══ YON — SECURITY: added verifyTransaction ═══
router.post('/shipper/:agreementId/deposit', authenticate, verifyTransaction, escrowController.depositEscrow);
// ═══ YON End ═══

// ═══ YON — HISTORY: new refund recording endpoint ═══
// POST /api/escrow/shipper/:agreementId/refund
router.post('/shipper/:agreementId/refund', authenticate, verifyTransaction, refundController.recordRefund);
// ═══ YON End ═══

module.exports = router;