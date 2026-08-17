const express = require("express");
const path = require("path");

const router = express.Router();

// =====================================================
// SERVE STATIC FILES FROM THE SHIPPER FOLDER
// =====================================================

const SHIPPER_DIR = path.join(__dirname, "../../frontend/pages/shipper");

router.use(express.static(SHIPPER_DIR));

// =====================================================
// MAP /shipper AND /shipper.html TO shipper.html
// =====================================================

router.get("/shipper", (req, res) => {
  res.sendFile(path.join(SHIPPER_DIR, "shipper.html"));
});

router.get("/shipper.html", (req, res) => {
  res.sendFile(path.join(SHIPPER_DIR, "shipper.html"));
});

router.get("/deposit_balance.html", (req, res) => {
  res.sendFile(path.join(SHIPPER_DIR, "deposit_balance.html"));
});

module.exports = router;
