const express = require("express");
const { getNonce, register } = require("../controllers/authController");

const router = express.Router();

router.get("/nonce/:address", getNonce);
router.post("/register", register);

module.exports = router;
