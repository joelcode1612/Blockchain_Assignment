const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const { authenticate } = require('../middleware/auth');

// GET /api/history/:agreementId
router.get('/:agreementId', authenticate, historyController.getHistory);
router.get('/', authenticate, historyController.getHistory);

module.exports = router;