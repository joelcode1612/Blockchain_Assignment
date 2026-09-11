// ═══ YON — SECURITY MODULE ═══
// Simple in-memory rate limiter for the API. Keys are the authenticated
// wallet address (decoded from the JWT) or the client IP as a fallback.
const jwt = require('jsonwebtoken');
// Requiring the shared config loads .env, so JWT_SECRET is available here even
// though this middleware runs before the route-level auth middleware.
require('../config/index');

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 120;

const hits = new Map();

///Fix - auth incpmplete migration
// Auth moved from the x-wallet-address header to a JWT, so this limiter was
// silently falling back to per-IP keys. Decode the token (best effort) to keep
// per-wallet limiting; the legacy header is still honoured.
function walletKeyFromRequest(req) {
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(
        authHeader.substring(7),
        process.env.JWT_SECRET,
      );
      if (decoded && decoded.walletAddress) {
        return String(decoded.walletAddress).toLowerCase();
      }
    } catch (error) {
      // Invalid/expired token — fall through. authenticate will reject it.
    }
  }

  return (req.headers['x-wallet-address'] || '').toString().toLowerCase();
}
///Fix end

exports.apiRateLimiter = (req, res, next) => {
  try {
    const key = walletKeyFromRequest(req) || 'ip:' + (req.ip || 'unknown');

    const now = Date.now();
    const entry = hits.get(key) || { start: now, count: 0 };

    if (now - entry.start > WINDOW_MS) {
      entry.start = now;
      entry.count = 0;
    }
    entry.count += 1;
    hits.set(key, entry);

    if (entry.count > MAX_REQUESTS) {
      return res
        .status(429)
        .json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  } catch (error) {
    console.warn('⚠️ [Yon/rateLimiter] error, allowing request:', error.message);
    next(); // fail-open
  }
};
// ═══ YON End ═══
