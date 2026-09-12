const supabase = require('../config/supabase');
const { ethers } = require('ethers');

// ─── Helper: safe format Ether ──────────────────────────────
function safeFormatEther(amount) {
  try {
    return ethers.formatEther(amount || '0');
  } catch (e) {
    console.warn('Format error:', e.message);
    return '0';
  }
}

// ─── Helper: find agreement by onchain_id ──────────────────
async function findAgreementByOnchainId(onchainId) {
  const { data, error } = await supabase
    .from('agreements')
    .select('*')
    .eq('onchain_id', parseInt(onchainId))
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Helper: paginate array ─────────────────────────────────
function paginateArray(items, page, limit) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * limit;
  const to = from + limit;
  return {
    items: items.slice(from, to),
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
      hasPrev: safePage > 1,
      hasNext: safePage < totalPages,
    },
  };
}

// ═══════════════════════════════════════════════════════════
// GET /api/history/:agreementId
// ═══════════════════════════════════════════════════════════
exports.getHistory = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const userWallet = req.user?.wallet_address?.toLowerCase();
    const roleFilter = req.query.role;

    if (!userWallet) return res.status(401).json({ error: 'Unauthorized' });

    const agreement = await findAgreementByOnchainId(agreementId);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

    const shipper = agreement.shipper_wallet?.toLowerCase();
    const carrier = agreement.carrier_wallet?.toLowerCase();
    if (shipper !== userWallet && carrier !== userWallet) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // ─── Fetch only money-related tables ────────────────────
    let deposits = [], payments = [], refunds = [];

    try {
      const r = await supabase
        .from('escrow_history')
        .select('*')
        .eq('agreement_onchain_id', agreement.onchain_id)
        .order('funded_at', { ascending: false });
      if (r.data) deposits = r.data;
    } catch (e) { console.warn('escrow_history query error:', e.message); }

    try {
      const r = await supabase
        .from('payment_history')
        .select('*')
        .eq('agreement_onchain_id', agreement.onchain_id)
        .order('paid_at', { ascending: false });
      if (r.data) payments = r.data;
    } catch (e) { console.warn('payment_history query error:', e.message); }

    try {
      const r = await supabase
        .from('refund_history')
        .select('*')
        .eq('agreement_onchain_id', agreement.onchain_id)
        .order('refunded_at', { ascending: false });
      if (r.data) refunds = r.data;
    } catch (e) { console.warn('refund_history query error:', e.message); }

    const events = [];

    // ─── Deposits (hidden from carrier) ─────────────────────
    if (roleFilter !== 'carrier') {
      deposits.forEach(d => {
        events.push({
          agreementId: d.agreement_onchain_id,
          type: 'Deposit',
          amount: d.amount,
          amountEth: safeFormatEther(d.amount),
          txHash: d.transaction_hash || '—',
          timestamp: d.funded_at || agreement.created_at,
          status: 'completed',
          description: 'Escrow funded',
        });
      });
    }

    // ─── Payment releases (visible to both) ─────────────────
    payments.forEach(p => {
      events.push({
        agreementId: p.agreement_onchain_id,
        type: `Payment Release (Milestone ${p.milestone_index + 1})`,
        amount: p.amount,
        amountEth: safeFormatEther(p.amount),
        txHash: p.transaction_hash || '—',
        timestamp: p.paid_at || agreement.updated_at,
        status: 'completed',
        description: `Payment to ${p.receiver_wallet}`,
      });
    });

    // ─── Refunds (hidden from carrier) ──────────────────────
    if (roleFilter !== 'carrier') {
      refunds.forEach(r => {
        events.push({
          agreementId: r.agreement_onchain_id,
          type: 'Refund',
          amount: r.amount,
          amountEth: safeFormatEther(r.amount),
          txHash: r.transaction_hash || '—',
          timestamp: r.refunded_at || agreement.updated_at,
          status: 'completed',
          description: 'Remaining escrow refunded to Shipper',
        });
      });
    }

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const { items, pagination } = paginateArray(events, page, limit);

    res.json({
      agreementId: agreement.onchain_id,
      totalPayments: pagination.total,
      payments: items,
      pagination,
    });
  } catch (error) {
    console.error('❌ getHistory error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/history
// ═══════════════════════════════════════════════════════════
exports.getAllHistory = async (req, res) => {
  try {
    const userWallet = req.user?.wallet_address?.toLowerCase();
    const roleFilter = req.query.role;

    if (!userWallet) return res.status(401).json({ error: 'Unauthorized' });

    const { data: agreements, error: agError } = await supabase
      .from('agreements')
      .select('onchain_id, shipper_wallet, carrier_wallet, escrow_amount, released_amount, created_at, updated_at')
      .or(`shipper_wallet.eq.${userWallet},carrier_wallet.eq.${userWallet}`);

    if (agError || !agreements || agreements.length === 0) {
      return res.json({
        totalPayments: 0,
        payments: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        },
      });
    }

    const agreementIds = agreements.map(a => a.onchain_id);

    let deposits = [], payments = [], refunds = [];

    try {
      const r = await supabase
        .from('escrow_history')
        .select('*')
        .in('agreement_onchain_id', agreementIds)
        .order('funded_at', { ascending: false });
      if (r.data) deposits = r.data;
    } catch (e) { console.warn('escrow_history query error:', e.message); }

    try {
      const r = await supabase
        .from('payment_history')
        .select('*')
        .in('agreement_onchain_id', agreementIds)
        .order('paid_at', { ascending: false });
      if (r.data) payments = r.data;
    } catch (e) { console.warn('payment_history query error:', e.message); }

    try {
      const r = await supabase
        .from('refund_history')
        .select('*')
        .in('agreement_onchain_id', agreementIds)
        .order('refunded_at', { ascending: false });
      if (r.data) refunds = r.data;
    } catch (e) { console.warn('refund_history query error:', e.message); }

    const events = [];

    // ─── Deposits (hidden from carrier) ─────────────────────
    if (roleFilter !== 'carrier') {
      deposits.forEach(d => {
        events.push({
          agreementId: d.agreement_onchain_id,
          type: 'Deposit',
          amount: d.amount,
          amountEth: safeFormatEther(d.amount),
          txHash: d.transaction_hash || '—',
          timestamp: d.funded_at,
          status: 'completed',
          description: `Escrow funded for AGR-${String(d.agreement_onchain_id).padStart(4, '0')}`,
        });
      });
    }

    // ─── Payment releases ───────────────────────────────────
    payments.forEach(p => {
      events.push({
        agreementId: p.agreement_onchain_id,
        type: `Payment Release (Milestone ${p.milestone_index + 1})`,
        amount: p.amount,
        amountEth: safeFormatEther(p.amount),
        txHash: p.transaction_hash || '—',
        timestamp: p.paid_at,
        status: 'completed',
        description: `Payment to ${p.receiver_wallet} for AGR-${String(p.agreement_onchain_id).padStart(4, '0')}`,
      });
    });

    // ─── Refunds (hidden from carrier) ──────────────────────
    if (roleFilter !== 'carrier') {
      refunds.forEach(r => {
        events.push({
          agreementId: r.agreement_onchain_id,
          type: 'Refund',
          amount: r.amount,
          amountEth: safeFormatEther(r.amount),
          txHash: r.transaction_hash || '—',
          timestamp: r.refunded_at,
          status: 'completed',
          description: `Remaining escrow refunded for AGR-${String(r.agreement_onchain_id).padStart(4, '0')}`,
        });
      });
    }

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const { items, pagination } = paginateArray(events, page, limit);

    res.json({
      totalPayments: pagination.total,
      payments: items,
      pagination,
    });
  } catch (error) {
    console.error('❌ getAllHistory error:', error);
    res.status(500).json({ error: error.message });
  }
};