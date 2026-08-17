const express = require('express');
const router = express.Router();
const escrowController = require('../controllers/depositController');
const { authenticate } = require('../middleware/auth');

// GET /api/escrow/:agreementId/balance
// Returns the current escrow balance for an agreement.
router.get('/:agreementId/balance', authenticate, escrowController.viewEscrowBalance);

// POST /api/escrow/:agreementId/deposit
// Shipper deposits funds into the escrow (requires authentication).
router.post('/:agreementId/deposit', authenticate, escrowController.depositEscrow);

router.get('/deposit_balance.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/pages/shipper/deposit_balance.html'));
});

// (Optional) GET /api/escrow/:agreementId/lock
// Confirm that funds are locked (if needed).
// router.get('/:agreementId/lock', authenticate, escrowController.lockEscrowFunds);

module.exports = router;