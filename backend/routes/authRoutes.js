const express = require("express");
const { getNonce, register, login } = require("../controllers/authController");

const router = express.Router();

// Public authentication routes
router.get("/nonce/:address", getNonce);
router.post("/register", register);
router.post("/login", login);

module.exports = router;
