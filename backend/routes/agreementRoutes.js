const express = require('express');
const router = express.Router();
const agreementController = require('../controllers/agreementController');
const { authenticate } = require('../middleware/auth');

// GET /api/agreements
router.get('/', authenticate, agreementController.getAgreements);

// POST /api/agreements/create
router.post('/create', authenticate, agreementController.createAndFundAgreement);

module.exports = router;