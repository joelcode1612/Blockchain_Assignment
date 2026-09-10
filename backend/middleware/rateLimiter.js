// ═══ YON — SECURITY MODULE ═══
// Simple in-memory rate limiter for the API. Keys are the wallet address
// (from the x-wallet-address header) or the client IP as a fallback.
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 120;

const hits = new Map();

exports.apiRateLimiter = (req, res, next) => {
  try {
    const walletHeader = (req.headers['x-wallet-address'] || '')
      .toString()
      .toLowerCase();
    const key = walletHeader || 'ip:' + (req.ip || 'unknown');

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
