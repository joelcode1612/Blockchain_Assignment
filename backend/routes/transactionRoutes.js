// routes/transactionRoutes.js

const express = require("express");
const path = require("path");

const router = express.Router();

const PAGES_DIR = path.join(__dirname, "../../frontend/pages");

// =====================================================
// PAGE HELPER
// =====================================================

const page = (url, file) => {
  router.get(url, (req, res) => {
    res.sendFile(path.join(PAGES_DIR, file));
  });
};

// =====================================================
// TRANSACTION RESULT PAGES
// =====================================================

page("/transaction-success", "shared/transaction-success.html");

page("/transaction-success.html", "shared/transaction-success.html");

page("/transaction-error", "shared/transaction-error.html");

page("/transaction-error.html", "shared/transaction-error.html");

module.exports = router;
