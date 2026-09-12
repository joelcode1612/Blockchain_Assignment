const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const AuthService = require("../services/authService");

function registrationMessage(nonce) {
  return `Traxen Account Registration\n\nPlease sign this message to verify that you control this wallet.\n\nThis signature does not send a transaction and does not cost gas.\n\nNonce: ${nonce}`;
}
function loginMessage(nonce) {
  return `Traxen Login Verification\n\nPlease sign this message to verify that you control this wallet.\n\nThis signature does not send a transaction and does not cost gas.\n\nNonce: ${nonce}`;
}
function createToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
  return jwt.sign(
    {
      userId: user.id,
      walletAddress: user.wallet_address.toLowerCase(),
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" },
  );
}

exports.getNonce = async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address))
      return res
        .status(400)
        .json({ success: false, message: "Invalid wallet address" });
    const nonce = AuthService.generateNonce(address);
    return res.status(200).json({ success: true, nonce });
  } catch (error) {
    console.error("❌ Get nonce error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create nonce" });
  }
};

exports.register = async (req, res) => {
  try {
    const wallet = req.body.wallet_address || req.body.walletAddress;
    const name = req.body.display_name || req.body.displayName;
    const role = req.body.role;
    const email = req.body.email || null;
    const signature = req.body.signature;
    const message = req.body.message;
    if (!wallet || !name || !role || !signature || !message)
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Wallet, name, role, signature and authentication message are required",
        });
    if (!ethers.isAddress(wallet))
      return res
        .status(400)
        .json({ success: false, message: "Invalid wallet address" });
    if (!["Shipper", "Carrier"].includes(role))
      return res.status(400).json({ success: false, message: "Invalid role" });

    const walletKey = wallet.toLowerCase();
    const nonce = AuthService.getNonce(walletKey);
    if (!nonce)
      return res
        .status(401)
        .json({
          success: false,
          message: "Authentication nonce expired or not found",
        });
    if (message !== registrationMessage(nonce))
      return res
        .status(401)
        .json({ success: false, message: "Invalid authentication message" });
    if (!AuthService.verifySignature(message, signature, walletKey))
      return res
        .status(401)
        .json({
          success: false,
          message: "Wallet signature verification failed",
        });

    const existing = await AuthService.getUserByWallet(walletKey);
    if (existing) {
      AuthService.deleteNonce(walletKey);
      return res
        .status(409)
        .json({
          success: false,
          message: "This wallet is already registered",
          role: existing.role,
        });
    }

    const user = await AuthService.createUser(walletKey, name, role, email);
    AuthService.deleteNonce(walletKey);
    return res
      .status(201)
      .json({
        success: true,
        authenticated: true,
        message: "Registration and authentication successful",
        token: createToken(user),
        user,
      });
  } catch (error) {
    console.error("❌ Registration error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Registration failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    if (!walletAddress || !signature || !message)
      return res
        .status(400)
        .json({
          success: false,
          message: "Wallet address, signature and message are required",
        });
    if (!ethers.isAddress(walletAddress))
      return res
        .status(400)
        .json({ success: false, message: "Invalid wallet address" });

    const walletKey = walletAddress.toLowerCase();
    const nonce = AuthService.getNonce(walletKey);
    if (!nonce)
      return res
        .status(401)
        .json({
          success: false,
          message: "Authentication nonce expired or not found",
        });
    if (message !== loginMessage(nonce))
      return res
        .status(401)
        .json({ success: false, message: "Invalid authentication message" });
    if (!AuthService.verifySignature(message, signature, walletKey))
      return res
        .status(401)
        .json({
          success: false,
          message: "Wallet signature verification failed",
        });

    const user = await AuthService.getUserByWallet(walletKey);
    if (!user) {
      AuthService.deleteNonce(walletKey);
      return res
        .status(404)
        .json({ success: false, message: "Wallet is not registered" });
    }
    AuthService.deleteNonce(walletKey);
    return res
      .status(200)
      .json({
        success: true,
        authenticated: true,
        message: "Login successful",
        token: createToken(user),
        user,
      });
  } catch (error) {
    console.error("❌ Login error:", error);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};
