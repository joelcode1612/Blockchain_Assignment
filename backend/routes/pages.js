const express = require('express');
const path = require('path');

const router = express.Router();

// Base directory of the frontend page files
const PAGES_DIR = path.join(__dirname, '../../frontend/pages');

// Map a clean URL to a page file relative to PAGES_DIR
const page = (url, file) => {
  router.get(url, (req, res) => {
    res.sendFile(path.join(PAGES_DIR, file));
  });
};

// ─── Public / Auth ──────────────────────────────────────────
page('/', 'public/index.html');
page('/index.html', 'public/index.html');
page('/login', 'login.html');
page('/login.html', 'login.html');
page('/register', 'register.html');
page('/register.html', 'register.html');

// ─── Escrow module pages ────────────────────────────────────
page('/deposit_balance', 'deposit_balance.html');
page('/deposit_balance.html', 'deposit_balance.html');
page('/milestone_release', 'milestone_release.html');
page('/milestone_release.html', 'milestone_release.html');
page('/refund_expiry', 'refund_expiry.html');
page('/refund_expiry.html', 'refund_expiry.html');
page('/duplicate_guard', 'duplicate_guard.html');
page('/duplicate_guard.html', 'duplicate_guard.html');
page('/history', 'shared/history.html');
page('/history.html', 'shared/history.html');
page('/traxen-escrow', 'traxen-escrow.html');
page('/traxen-escrow.html', 'traxen-escrow.html');
page('/agreement-pending', 'agreement-pending.html');
page('/agreement-pending.html', 'agreement-pending.html');

// ─── Shipper pages ──────────────────────────────────────────
page('/shipper', 'shipper/shipper.html');
page('/shipper.html', 'shipper/shipper.html');
page('/agreements', 'shipper/agreements.html');
page('/agreements.html', 'shipper/agreements.html');
page('/create-agreement', 'shipper/create-agreement.html');
page('/create-agreement.html', 'shipper/create-agreement.html');
page('/agreement-details-shipper', 'shipper/agreement-details-shipper.html');
page('/agreement-details-shipper.html', 'shipper/agreement-details-shipper.html');

// ─── Carrier pages ──────────────────────────────────────────
page('/carrier', 'carrier/carrier.html');
page('/carrier.html', 'carrier/carrier.html');
page('/agreement-details-carrier', 'carrier/agreement-details-carrier.html');
page('/agreement-details-carrier.html', 'carrier/agreement-details-carrier.html');

// ─── Shared transaction result pages ────────────────────────
page('/transaction-success', 'shared/transaction-success.html');
page('/transaction-success.html', 'shared/transaction-success.html');
page('/transaction-error', 'shared/transaction-error.html');
page('/transaction-error.html', 'shared/transaction-error.html');

module.exports = router;