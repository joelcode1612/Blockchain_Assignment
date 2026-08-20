const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

// POST /api/payment/release
router.post('/release', authenticate, paymentController.recordPaymentRelease);

module.exports = router;