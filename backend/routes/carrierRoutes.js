const express = require("express");
const path = require("path");

const router = express.Router();

// =====================================================
// SERVE STATIC FILES FROM THE CARRIER FOLDER
// =====================================================

const CARRIER_DIR = path.join(__dirname, "../../frontend/pages/carrier");

// This will serve any file in that folder: e.g., /carrier/carrier_available_job.html
router.use(express.static(CARRIER_DIR));

// =====================================================
// MAP /carrier AND /carrier.html TO carrier.html
// =====================================================

router.get("/carrier.html", (req, res) => {
  res.sendFile(path.join(CARRIER_DIR, "carrier_dashboard.html"));
});
// router.get("carrier/carrier_dashboard.html", (req, res) => {
//   res.sendFile(path.join(CARRIER_DIR, "carrier_dashboard.html"));
// });

module.exports = router;

