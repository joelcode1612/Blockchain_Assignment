const supabase = require("../config/supabase");

// =====================================================
// AUTHENTICATE USER
// =====================================================

exports.authenticate = async (req, res, next) => {
  try {
    const walletAddress = req.headers["x-wallet-address"];

    console.log("🔍 authenticate - walletAddress:", walletAddress);

    if (!walletAddress) {
      return res.status(401).json({ error: "Wallet address required" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .single();

    if (!user) {
      console.warn("⚠️ User not found for address:", walletAddress);
      return res.status(401).json({ error: "User not registered" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("❌ Auth error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// =====================================================
// AUTHORIZE ROLE
// =====================================================

exports.authorize = (role) => {
  return (req, res, next) => {
    // Make sure authentication happened first
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    // Check role
    if (req.user.role !== role) {
      return res.status(403).json({
        error: `Requires ${role} role`,
      });
    }

    next();
  };
};
