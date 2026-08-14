const express = require('express');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Base directory of the frontend page files
// If your escrow pages are in frontend/page_updated/, change to:
// const PAGES_DIR = path.join(__dirname, '../../frontend/page_updated');
const PAGES_DIR = path.join(__dirname, '../../frontend/html');

// ─── Map a clean URL to a page file ─────────────────────────
const page = (url, file) => {
  router.get(url, (req, res) => {
    res.sendFile(path.join(PAGES_DIR, file));
  });
};

// ─── Protected page (requires login) ────────────────────────
const protectedPage = (url, file) => {
  router.get(url, authenticate, (req, res) => {
    res.sendFile(path.join(PAGES_DIR, file));
  });
};

// ─── Shipper-only page ──────────────────────────────────────
const shipperPage = (url, file) => {
  router.get(url, authenticate, authorize('shipper'), (req, res) => {
    res.sendFile(path.join(PAGES_DIR, file));
  });
};

// ─── Carrier-only page ──────────────────────────────────────
const carrierPage = (url, file) => {
  router.get(url, authenticate, authorize('carrier'), (req, res) => {
    res.sendFile(path.join(PAGES_DIR, file));
  });
};

// ─── Public Pages (no auth) ──────────────────────────────────
page('/', '/index.html');
page('/index.html', '/index.html');
page('/login', '/login.html');
page('/login.html', '/login.html');
page('/register', '/register.html');
page('/register.html', '/register.html');

// ─── Escrow Module Pages (login required) ───────────────────
protectedPage('/agreement-list', 'agreement_list.html');
protectedPage('/agreement-list.html', 'agreement_list.html');
protectedPage('/escrow-overview', 'escrow_overview.html');
protectedPage('/escrow-overview.html', 'escrow_overview.html');
protectedPage('/milestone-tracking', 'milestone_tracking.html');
protectedPage('/milestone-tracking.html', 'milestone_tracking.html');
protectedPage('/refund-centre', 'refund_centre.html');
protectedPage('/refund-centre.html', 'refund_centre.html');
protectedPage('/history', 'history.html');
protectedPage('/history.html', 'history.html');
protectedPage('/deposit-balance', 'deposit_balance.html');
protectedPage('/deposit-balance.html', 'deposit_balance.html');
protectedPage('/milestone-release', 'milestone_release.html');
protectedPage('/milestone-release.html', 'milestone_release.html');
protectedPage('/duplicate-guard', 'duplicate_guard.html');
protectedPage('/duplicate-guard.html', 'duplicate_guard.html');
protectedPage('/refund-expiry', 'refund_expiry.html');
protectedPage('/refund-expiry.html', 'refund_expiry.html');

// ─── Shipper Pages (Shipper only) ───────────────────────────
shipperPage('/shipper', 'shipper/shipper.html');
shipperPage('/shipper.html', 'shipper/shipper.html');
shipperPage('/agreements', 'shipper/agreements.html');
shipperPage('/agreements.html', 'shipper/agreements.html');
shipperPage('/create-agreement', 'shipper/create-agreement.html');
shipperPage('/create-agreement.html', 'shipper/create-agreement.html');
shipperPage('/agreement-details-shipper', 'shipper/agreement-details-shipper.html');
shipperPage('/agreement-details-shipper.html', 'shipper/agreement-details-shipper.html');

// ─── Carrier Pages (Carrier only) ───────────────────────────
carrierPage('/carrier', 'carrier/carrier.html');
carrierPage('/carrier.html', 'carrier/carrier.html');
carrierPage('/agreement-details-carrier', 'carrier/agreement-details-carrier.html');
carrierPage('/agreement-details-carrier.html', 'carrier/agreement-details-carrier.html');

// ─── Shared Transaction Result Pages ────────────────────────
page('/transaction-success', 'shared/transaction-success.html');
page('/transaction-success.html', 'shared/transaction-success.html');
page('/transaction-error', 'shared/transaction-error.html');
page('/transaction-error.html', 'shared/transaction-error.html');

module.exports = router;