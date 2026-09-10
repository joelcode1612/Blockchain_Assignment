/// Fix - 2026-09-10 : single source of truth for RPC endpoints.
/// This module now loads .env itself so the value is correct no matter which
/// module is required first, keeps working if the legacy singular RPC_URL is
/// still set, and always yields at least one endpoint (previously it could
/// resolve to [] when dotenv had not run yet).
const path = require('path');

// dotenv.config() is idempotent, so calling it here is safe even when
// config/supabase.js already loaded the same file.
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DEFAULT_RPC_URLS = [
  'https://ethereum-sepolia.publicnode.com',
  'https://sepolia.gateway.tenderly.co',
];

// New comma-separated RPC_URLS wins; legacy single RPC_URL is still honoured.
const configuredRpcUrls = (process.env.RPC_URLS || process.env.RPC_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const RPC_URLS =
  configuredRpcUrls.length > 0 ? configuredRpcUrls : DEFAULT_RPC_URLS;
/// Fix end

module.exports = { RPC_URLS };