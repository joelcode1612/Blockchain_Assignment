const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");

const AuthService = require("../services/authService");

// =====================================================
// GET NONCE
// GET /api/auth/nonce/:address
// =====================================================

exports.getNonce = async (req, res) => {
  try {
    const { address } = req.params;

    // Validate wallet address
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address",
      });
    }

    // Generate a new nonce
    const nonce = AuthService.generateNonce(address);

    return res.status(200).json({
      success: true,
      nonce,
    });
  } catch (error) {
    console.error("❌ Get nonce error:", error);

    return res.status(500).json({
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
  try {
    console.log("📥 Registration request:", req.body);

    const wallet = req.body.wallet_address || req.body.walletAddress;
    const name = req.body.display_name || req.body.displayName;
    const role = req.body.role;
    const email = req.body.email || null;
    const signature = req.body.signature;
    const message = req.body.message;

    // --------------------------------------------------
    // 1. Validate required fields
    // --------------------------------------------------

    if (!wallet || !name || !role || !signature || !message) {
      return res.status(400).json({
        success: false,
        message:
          "Wallet, name, role, signature and authentication message are required",
      });
    }

    // --------------------------------------------------
    // 2. Validate wallet
    // --------------------------------------------------

    if (!ethers.isAddress(wallet)) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address",
      });
    }

    // --------------------------------------------------
    // 3. Validate role
    // --------------------------------------------------

    if (!["Shipper", "Carrier"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const walletKey = wallet.toLowerCase();

    // --------------------------------------------------
    // 4. Get nonce generated for this wallet
    // --------------------------------------------------

    const storedNonce = AuthService.getNonce(walletKey);

    if (!storedNonce) {
      return res.status(401).json({
        success: false,
        message: "Authentication nonce expired or not found",
      });
    }

    // --------------------------------------------------
    // 5. Make sure the nonce is actually in message
    // --------------------------------------------------

    if (!message.includes(storedNonce)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication message",
      });
    }

    // --------------------------------------------------
    // 6. Verify MetaMask signature
    // --------------------------------------------------

    let signatureValid = false;

    try {
      signatureValid = await AuthService.verifySignature(
        message,
        signature,
        walletKey,
      );
    } catch (signatureError) {
      console.error("❌ Signature verification error:", signatureError);

      return res.status(401).json({
        success: false,
        message: "Invalid wallet signature",
      });
    }

    if (!signatureValid) {
      return res.status(401).json({
        success: false,
        message: "Wallet signature verification failed",
      });
    }

    console.log("✅ Wallet signature verified:", walletKey);

    // --------------------------------------------------
    // 7. Prevent duplicate registration
    // --------------------------------------------------

    const existingUser = await AuthService.getUserByWallet(walletKey);

    if (existingUser) {
      AuthService.deleteNonce(walletKey);

      return res.status(409).json({
        success: false,
        message: "This wallet is already registered",
        role: existingUser.role,
      });
    }

    // --------------------------------------------------
    // 8. Create user
    // --------------------------------------------------

    const user = await AuthService.createUser(walletKey, name, role, email);

    // --------------------------------------------------
    // 9. Delete nonce so it cannot be reused
    // --------------------------------------------------

    AuthService.deleteNonce(walletKey);

    // --------------------------------------------------
    // 10. Create JWT
    // --------------------------------------------------

    const token = jwt.sign(
      {
        userId: user.id,
        walletAddress: walletKey,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "2h",
      },
    );

    console.log("✅ JWT created for:", walletKey);

    // --------------------------------------------------
    // 11. Return authentication result
    // --------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Registration and authentication successful",
      token,
      user,
    });
  } catch (error) {
    console.error("❌ Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

// =====================================================
// LOGIN
// POST /api/auth/login
// =====================================================

exports.login = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    // 1. Validate required fields
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        message: "Wallet address, signature and message are required",
      });
    }

    // 2. Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address",
      });
    }

    const walletKey = walletAddress.toLowerCase();

    // 3. Get nonce
    const storedNonce = AuthService.getNonce(walletKey);

    if (!storedNonce) {
      return res.status(401).json({
        success: false,
        message: "Authentication nonce expired or not found",
      });
    }

    // 4. Make sure nonce is part of signed message
    if (!message.includes(storedNonce)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication message",
      });
    }

    // 5. Verify MetaMask signature
    let signatureValid = false;

    try {
      signatureValid = await AuthService.verifySignature(
        message,
        signature,
        walletKey,
      );
    } catch (error) {
      console.error("❌ Login signature verification error:", error);

      return res.status(401).json({
        success: false,
        message: "Invalid wallet signature",
      });
    }

    if (!signatureValid) {
      return res.status(401).json({
        success: false,
        message: "Wallet signature verification failed",
      });
    }

    console.log("✅ Login wallet signature verified:", walletKey);

    // 6. Find registered user
    const user = await AuthService.getUserByWallet(walletKey);

    if (!user) {
      AuthService.deleteNonce(walletKey);

      return res.status(404).json({
        success: false,
        message: "Wallet is not registered",
      });
    }

    // 7. Delete nonce so it cannot be reused
    AuthService.deleteNonce(walletKey);

    // 8. Create JWT
    const token = jwt.sign(
      {
        userId: user.id,
        walletAddress: walletKey,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "2h",
      },
    );

    console.log("✅ Login JWT created for:", walletKey);

    // 9. Return authenticated user + JWT
    return res.status(200).json({
      success: true,
      authenticated: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("❌ Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};
