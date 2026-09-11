const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

// =====================================================
// AUTHENTICATE USER USING JWT
// =====================================================

exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // No Authorization header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication token required",
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error("❌ JWT verification failed:", error.message);

      return res.status(401).json({
        error: "Invalid or expired authentication token",
      });
    }

    // Find current user in database
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", decoded.walletAddress.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: "User not found",
      });
    }

    // Make authenticated user available to routes
    req.user = user;

    next();
  } catch (error) {
    console.error("❌ Authentication middleware error:", error);

    return res.status(500).json({
      error: "Authentication failed",
    });
  }
};

// =====================================================
// AUTHORIZE ROLE
// =====================================================

exports.authorize = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        error: `Requires ${role} role`,
      });
    }

    next();
  };
};
