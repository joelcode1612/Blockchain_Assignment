// ═══ YON — SECURITY MODULE ═══
// Verifies that a transaction hash reported by the frontend actually
// exists on-chain, was successful, and was sent by the authenticated wallet.
// Designed to fail open (log + continue) when all RPC providers are
// unreachable, so a temporary RPC outage never blocks other team flows.
const { ethers } = require('ethers');

/// Fix : read the RPC list from the one shared config module.
/// Previously this read the now-removed process.env.RPC_URL and fell back to a
/// local list that still contained the deprecated ankr endpoint, so the
/// backend ignored the team's configured RPC_URLS.
const { RPC_URLS } = require('../config/index');
/// Fix end

async function getWorkingProvider() {
  for (const url of RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      return provider;
    } catch (error) {
      console.warn(`⚠️ [Yon/verifyTx] Failed to connect to ${url}:`, error.message);
    }
  }
  throw new Error('All RPC providers failed');
}

function extractTxHash(body) {
  if (!body || typeof body !== 'object') return null;
  return (
    body.txHash ||
    body.createTx ||
    body.acceptTx ||
    body.rejectTx ||
    body.fundTx ||
    null
  );
}

exports.verifyTransaction = async (req, res, next) => {
  try {
    const txHash = extractTxHash(req.body);
    const user =
      req.user && req.user.wallet_address
        ? req.user.wallet_address.toLowerCase()
        : null;

    if (!txHash || !user) {
      return res
        .status(400)
        .json({ error: 'Transaction hash or authenticated wallet missing' });
    }

    let receipt = null;
    try {
      const provider = await getWorkingProvider();
      receipt = await provider.getTransactionReceipt(txHash);
    } catch (error) {
      console.warn(
        '⚠️ [Yon/verifyTx] RPC unavailable, allowing request through:',
        error.message,
      );
      return next(); // fail-open: don't break other members' flows on RPC outage
    }

    if (!receipt) {
      return res
        .status(400)
        .json({ error: 'Transaction hash not found on the blockchain' });
    }
    if (receipt.status !== 1) {
      return res
        .status(400)
        .json({ error: 'Transaction was reverted on the blockchain' });
    }
    if (receipt.from && receipt.from.toLowerCase() !== user) {
      return res
        .status(403)
        .json({ error: 'Transaction was not sent by the authenticated wallet' });
    }

    req.verifiedReceipt = receipt;
    next();
  } catch (error) {
    console.error(
      '❌ [Yon/verifyTx] Unexpected error, allowing request through:',
      error.message,
    );
    return next(); // fail-open on unexpected errors
  }
};
// ═══ YON End ═══
