// ═══ YON — REPUTATION MODULE ═══
const { ethers } = require('ethers');
const supabase = require('../config/supabase');
const reputationService = require('../services/reputationService');

// GET /api/reputation/me
exports.getMyReputation = async (req, res) => {
  try {
    const wallet = req.user.wallet_address;

    try {
      const balanceRaw = await reputationService.getBalance(wallet);
      const info = await reputationService.getTokenInfo();

      return res.json({
        wallet,
        source: 'blockchain',
        name: info.name,
        symbol: info.symbol,
        decimals: info.decimals,
        rawBalance: balanceRaw,
        balanceFormatted: ethers.formatUnits(balanceRaw, info.decimals),
      });
    } catch (error) {
      // Blockchain read failed (e.g. RPC down) — fall back to the
      // database mirror so the UI still shows something sensible.
      console.warn(
        '⚠️ [Yon] Blockchain reputation read failed, falling back to database:',
        error.message,
      );

      const { data: user } = await supabase
        .from('users')
        .select('reputation_balance')
        .eq('wallet_address', wallet.toLowerCase())
        .maybeSingle();

      const { data: history } = await supabase
        .from('reputation_history')
        .select('*')
        .eq('carrier_wallet', wallet.toLowerCase())
        .order('rewarded_at', { ascending: false });

      const dbBalance = user ? Number(user.reputation_balance || 0) : 0;
      return res.json({
        wallet,
        source: 'database',
        symbol: 'REP',
        rawBalance: String(dbBalance),
        balanceFormatted: String(dbBalance),
        rewards: history || [],
      });
    }
  } catch (error) {
    console.error('❌ [Yon] getMyReputation error:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/reputation/history
exports.getMyReputationHistory = async (req, res) => {
  try {
    const wallet = req.user.wallet_address;

    const { data, error } = await supabase
      .from('reputation_history')
      .select('*')
      .eq('carrier_wallet', wallet.toLowerCase())
      .order('rewarded_at', { ascending: false });

    if (error) throw error;

    res.json({ wallet, rewards: data || [] });
  } catch (error) {
    console.error('❌ [Yon] getMyReputationHistory error:', error);
    res.status(500).json({ error: error.message });
  }
};
// ═══ YON End ═══
