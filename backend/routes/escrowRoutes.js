const express = require("express");
const path = require("path");

const { authenticate } = require("../middleware/auth.js");

const router = express.Router();

const PAGES_DIR = path.join(__dirname, "../../frontend/pages");

// =====================================================
// ESCROW PAGE HELPER
// =====================================================

const protectedPage = (url, file) => {
  router.get(url, authenticate, (req, res) => {
    res.sendFile(path.join(PAGES_DIR, file));
  });
};

// =====================================================
// ESCROW MODULE
// =====================================================

protectedPage("/agreement-list", "agreement_list.html");

protectedPage("/agreement-list.html", "agreement_list.html");

protectedPage("/escrow-overview", "escrow_overview.html");

protectedPage("/escrow-overview.html", "escrow_overview.html");

protectedPage("/milestone-tracking", "milestone_tracking.html");

protectedPage("/milestone-tracking.html", "milestone_tracking.html");

protectedPage("/refund-centre", "refund_centre.html");

protectedPage("/refund-centre.html", "refund_centre.html");

protectedPage("/history", "history.html");

protectedPage("/history.html", "history.html");

protectedPage("/deposit-balance", "deposit_balance.html");

protectedPage("/deposit-balance.html", "deposit_balance.html");

protectedPage("/milestone-release", "milestone_release.html");

protectedPage("/milestone-release.html", "milestone_release.html");

protectedPage("/duplicate-guard", "duplicate_guard.html");

protectedPage("/duplicate-guard.html", "duplicate_guard.html");

protectedPage("/refund-expiry", "refund_expiry.html");

protectedPage("/refund-expiry.html", "refund_expiry.html");

module.exports = router;
