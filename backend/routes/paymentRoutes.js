// const express = require('express');
// const router = express.Router();
// const paymentController = require('../controllers/paymentController');
// const { authenticate, authorize } = require('../middleware/auth');

// // GET /api/payment/:agreementId/milestone/:milestoneId/calculate
// router.get('/:agreementId/milestone/:milestoneId/calculate', authenticate, paymentController.calculatePayment);

// // POST /api/payment/:agreementId/milestone/:milestoneId/release
// router.post('/:agreementId/milestone/:milestoneId/release', authenticate, authorize('shipper'), paymentController.releasePayment);

// // GET /api/payment/:agreementId/history
// router.get('/:agreementId/history', authenticate, paymentController.viewPaymentHistory);

// module.exports = router;