const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Authentication token required" });
    const token = authHeader.substring(7).trim();
    if (!token)
      return res.status(401).json({ error: "Authentication token required" });
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET is not configured.");
      return res
        .status(500)
        .json({ error: "Authentication configuration error" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res
        .status(401)
        .json({ error: "Invalid or expired authentication token" });
    }

    if (!decoded.walletAddress)
      return res.status(401).json({ error: "Invalid authentication token" });
    const walletAddress = decoded.walletAddress.toLowerCase();
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();
    if (error || !user)
      return res.status(401).json({ error: "User not found" });

    req.auth = decoded;
    req.user = user;
    return next();
  } catch (error) {
    console.error("❌ Authentication middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

exports.authorize = (role) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ error: "Authentication required" });
  if (req.user.role !== role)
    return res.status(403).json({ error: `Requires ${role} role` });
  next();
};
