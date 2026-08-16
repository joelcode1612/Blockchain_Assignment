const { ethers } = require("ethers");

const AuthService = require("../services/authService");

// =====================================================
// GET NONCE
// GET /api/auth/nonce/:address
// =====================================================

exports.getNonce = async (req, res) => {
  try {
    const { address } = req.params;

    // ---------------------------------------------
    // Validate wallet address
    // ---------------------------------------------

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address",
      });
    }

    // ---------------------------------------------
    // Generate nonce
    // ---------------------------------------------

    const nonce = AuthService.generateNonce(address);

    res.json({
      success: true,
      nonce,
    });
  } catch (error) {
    console.error("Get nonce error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create nonce",
    });
  }
};

// =====================================================
// REGISTER
// POST /api/auth/register
// =====================================================

exports.register = async (req, res) => {
  // 1. Debug log to see EXACTLY what the frontend sent
  console.log("📥 Incoming Registration Data:", req.body);

  try {
    // 2. Accept both snake_case (frontend) or camelCase just in case!
    const wallet = req.body.wallet_address || req.body.walletAddress;
    const name = req.body.display_name || req.body.displayName;
    const role = req.body.role;
    const email = req.body.email || null;

    // 3. Simple validation (Removed signature and message)
    if (!wallet || !name || !role) {
      console.log(
        "❌ Missing fields! Wallet:",
        wallet,
        "Name:",
        name,
        "Role:",
        role,
      );
      return res.status(400).json({
        success: false,
        message: "Missing registration information",
      });
    }

    if (!ethers.isAddress(wallet)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid wallet address" });
    }

    if (!["Shipper", "Carrier"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const walletKey = wallet.toLowerCase();

    // 4. Check database
    const existingUser = await AuthService.getUserByWallet(walletKey);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This wallet is already registered in the database",
        role: existingUser.role,
      });
    }

    // 5. Create User
    const user = await AuthService.createUser(walletKey, name, role, email);

    console.log("✅ User successfully saved to database!");
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user,
    });
  } catch (error) {
    console.error("🚨 Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};
