const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const AuthService = require("../services/authService");

// =====================================================
// MESSAGE BUILDERS
// =====================================================
// ⚠️ These MUST match the frontend exactly.
// If you change one, change the other.

function buildRegisterMessage({ wallet, role, name, email, nonce }) {
  return (
    `Traxen Account Registration\n\n` +
    `Please sign this message to verify that you control this wallet.\n` +
    `This signature does not send a transaction and does not cost gas.\n\n` +
    `Wallet: ${wallet}\n` +
    `Role: ${role}\n` +
    `Name: ${name}\n` +
    `Email: ${email}\n` +
    `Nonce: ${nonce}`
  );
}

function buildLoginMessage({ wallet, nonce }) {
  return (
    `Traxen Login Verification\n\n` +
    `Please sign this message to verify that you control this wallet.\n` +
    `This signature does not send a transaction and does not cost gas.\n\n` +
    `Wallet: ${wallet}\n` +
    `Nonce: ${nonce}`
  );
}

// =====================================================
// GET NONCE
// =====================================================

exports.getNonce = async (req, res) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address",
      });
    }

    const nonce = AuthService.generateNonce(address);

    return res.status(200).json({ success: true, nonce });
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
// =====================================================

exports.register = async (req, res) => {
  try {
    console.log("📥 Registration request:", {
      wallet: req.body.wallet_address || req.body.walletAddress,
      role: req.body.role,
      hasSignature: !!req.body.signature,
    });

    const wallet = req.body.wallet_address || req.body.walletAddress;
    const name = req.body.display_name || req.body.displayName;
    const role = req.body.role;
    const email = req.body.email || null;
    const signature = req.body.signature;
    const message = req.body.message;

    if (!wallet || !name || !role || !signature || !message) {
      return res.status(400).json({
        success: false,
        message:
          "Wallet, name, role, signature and authentication message are required",
      });
    }

    if (!ethers.isAddress(wallet)) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address",
      });
    }

    const walletKey = wallet.toLowerCase();

    if (!["Shipper", "Carrier"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const storedNonce = AuthService.getNonce(walletKey);

    if (!storedNonce) {
      return res.status(401).json({
        success: false,
        message: "Authentication nonce expired or not found",
      });
    }

    // Rebuild expected message → compare
    const expectedMessage = buildRegisterMessage({
      wallet: walletKey,
      role,
      name,
      email: email || "",
      nonce: storedNonce,
    });

    if (message !== expectedMessage) {
      AuthService.deleteNonce(walletKey);
      console.warn("❌ Message mismatch during registration");
      return res.status(401).json({
        success: false,
        message: "Authentication message does not match expected format",
      });
    }

    let signatureValid = false;

    try {
      signatureValid = await AuthService.verifySignature(
        message,
        signature,
        walletKey,
      );
    } catch (sigErr) {
      console.error("❌ Signature verification error:", sigErr);
      AuthService.deleteNonce(walletKey);
      return res.status(401).json({
        success: false,
        message: "Invalid wallet signature",
      });
    }

    if (!signatureValid) {
      AuthService.deleteNonce(walletKey);
      return res.status(401).json({
        success: false,
        message: "Wallet signature verification failed",
      });
    }

    console.log("✅ Wallet signature verified:", walletKey);

    // Verify on-chain role
    const chainRole = await AuthService.getOnChainRole(walletKey);

    if (!chainRole) {
      AuthService.deleteNonce(walletKey);
      console.warn("❌ Wallet not on-chain:", walletKey);
      return res.status(403).json({
        success: false,
        message:
          "This wallet is not registered on the blockchain. " +
          "Please complete on-chain registration first.",
      });
    }

    if (chainRole !== role) {
      AuthService.deleteNonce(walletKey);
      console.warn("❌ Role mismatch:", {
        requested: role,
        onChain: chainRole,
      });
      return res.status(403).json({
        success: false,
        message:
          `Role mismatch. The blockchain says this wallet is a ` +
          `${chainRole}, but you requested ${role}.`,
      });
    }

    console.log("✅ On-chain role verified:", chainRole);

    // Upsert
    const existingUser = await AuthService.getUserByWallet(walletKey);
    let user;

    if (existingUser) {
      console.log("♻️  Existing user — refreshing profile:", walletKey);
      user = await AuthService.updateUserProfile(walletKey, name, email);
      if (!user) user = existingUser;
    } else {
      console.log("🆕 Creating new user:", walletKey);
      user = await AuthService.createUser(walletKey, name, role, email);
    }

    AuthService.deleteNonce(walletKey);

    const token = jwt.sign(
      {
        userId: user.id,
        walletAddress: walletKey,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    console.log("✅ JWT created for:", walletKey);

    return res.status(200).json({
      success: true,
      message: existingUser
        ? "Profile refreshed and authentication successful"
        : "Registration and authentication successful",
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
// LOGIN  🔷 FULLY REWRITTEN
// =====================================================

exports.login = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        message: "Wallet address, signature and message are required",
      });
    }

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address",
      });
    }

    const walletKey = walletAddress.toLowerCase();

    const storedNonce = AuthService.getNonce(walletKey);

    if (!storedNonce) {
      return res.status(401).json({
        success: false,
        message: "Authentication nonce expired or not found",
      });
    }

    // Rebuild the expected login message
    const expectedMessage = buildLoginMessage({
      wallet: walletKey,
      nonce: storedNonce,
    });

    if (message !== expectedMessage) {
      AuthService.deleteNonce(walletKey);
      console.warn("❌ Login message mismatch");
      return res.status(401).json({
        success: false,
        message: "Authentication message does not match expected format",
      });
    }

    let signatureValid = false;

    try {
      signatureValid = await AuthService.verifySignature(
        message,
        signature,
        walletKey,
      );
    } catch (error) {
      console.error("❌ Login signature verification error:", error);
      AuthService.deleteNonce(walletKey);
      return res.status(401).json({
        success: false,
        message: "Invalid wallet signature",
      });
    }

    if (!signatureValid) {
      AuthService.deleteNonce(walletKey);
      return res.status(401).json({
        success: false,
        message: "Wallet signature verification failed",
      });
    }

    console.log("✅ Login wallet signature verified:", walletKey);

    // 🔷 Check blockchain: wallet must still exist on-chain
    const chainRole = await AuthService.getOnChainRole(walletKey);

    if (!chainRole) {
      AuthService.deleteNonce(walletKey);
      console.warn("❌ Login: wallet not on-chain:", walletKey);
      return res.status(403).json({
        success: false,
        message:
          "This wallet is no longer registered on the blockchain. " +
          "Please re-register.",
      });
    }

    console.log("✅ Login: on-chain role:", chainRole);

    // Find user in DB
    const user = await AuthService.getUserByWallet(walletKey);

    if (!user) {
      AuthService.deleteNonce(walletKey);
      return res.status(404).json({
        success: false,
        message:
          "This wallet is not registered in our system. " +
          "Please complete registration.",
      });
    }

    // 🔷 DB role must match chain role
    if (user.role !== chainRole) {
      AuthService.deleteNonce(walletKey);
      console.error("❌ Login role mismatch:", {
        db: user.role,
        chain: chainRole,
      });
      return res.status(403).json({
        success: false,
        message:
          "Your account is out of sync with the blockchain. " +
          "Please re-register.",
      });
    }

    AuthService.deleteNonce(walletKey);

    const token = jwt.sign(
      {
        userId: user.id,
        walletAddress: walletKey,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    console.log("✅ Login JWT created for:", walletKey);

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
