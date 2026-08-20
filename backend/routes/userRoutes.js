const express = require("express");

const router = express.Router();

const { authenticate } = require("../middleware/auth");
const userController = require("../controllers/userController");

// GET /api/users/me  ->  Get the current logged-in user's profile
router.get("/me", authenticate, userController.getProfile);

// PUT /api/users/me  ->  Update the current logged-in user's profile
router.put("/me", authenticate, userController.updateProfile);

// GET /api/users/carriers  ->  Get all registered carriers for shipper selection
router.get("/carriers", authenticate, userController.listCarriers);

module.exports = router;
