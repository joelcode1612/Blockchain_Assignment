const supabase = require('../config/supabase');
const { ethers } = require('ethers');

async function findAgreementByOnchainId(onchainId) {
  const { data, error } = await supabase
    .from('agreements')
    .select('*')
    .eq('onchain_id', parseInt(onchainId))
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * GET /api/history/:agreementId
 */
exports.getHistory = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const userWallet = req.user?.wallet_address?.toLowerCase();
    if (!userWallet) return res.status(401).json({ error: 'Unauthorized' });

    const agreement = await findAgreementByOnchainId(agreementId);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

    const shipper = agreement.shipper_wallet?.toLowerCase();
    const carrier = agreement.carrier_wallet?.toLowerCase();
    if (shipper !== userWallet && carrier !== userWallet) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Fetch deposits and payments – safe with fallback to empty arrays
    let deposits = [], payments = [];
    try {
      const depRes = await supabase
        .from('escrow_history')
        .select('*')
        .eq('agreement_onchain_id', agreement.onchain_id)
        .order('funded_at', { ascending: false });
      if (depRes.data) deposits = depRes.data;
    } catch (e) { console.warn('escrow_history query error:', e.message); }

    try {
      const payRes = await supabase
        .from('payment_history')
        .select('*')
        .eq('agreement_onchain_id', agreement.onchain_id)
        .order('paid_at', { ascending: false });
      if (payRes.data) payments = payRes.data;
    } catch (e) { console.warn('payment_history query error:', e.message); }

    const events = [];

    deposits.forEach(d => {
      events.push({
        type: 'Deposit',
        amount: d.amount,
        amountEth: ethers.formatEther(d.amount || '0'),
        txHash: d.transaction_hash || '—',
        timestamp: d.funded_at || agreement.created_at,
        status: 'completed',
        description: 'Escrow funded',
      });
    });

    payments.forEach(p => {
      events.push({
        type: `Payment Release (Milestone ${p.milestone_index + 1})`,
        amount: p.amount,
        amountEth: ethers.formatEther(p.amount || '0'),
        txHash: p.transaction_hash || '—',
        timestamp: p.paid_at || agreement.updated_at,
        status: 'completed',
        description: `Payment to ${p.receiver_wallet}`,
      });
    });

    // Fallback if no events
    if (events.length === 0) {
      const escrowWei = agreement.escrow_amount || '0';
      const releasedWei = agreement.released_amount || '0';
      if (BigInt(escrowWei) > 0) {
        events.push({
          type: 'Deposit',
          amount: escrowWei,
          amountEth: ethers.formatEther(escrowWei),
          txHash: '—',
          timestamp: agreement.created_at,
          status: 'completed',
          description: 'Escrow funded',
        });
      }
      if (BigInt(releasedWei) > 0) {
        events.push({
          type: 'Payment Release',
          amount: releasedWei,
          amountEth: ethers.formatEther(releasedWei),
          txHash: '—',
          timestamp: agreement.updated_at,
          status: 'completed',
          description: 'Payment released',
        });
      }
    }

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ agreementId: agreement.onchain_id, totalPayments: events.length, payments: events });
  } catch (error) {
    console.error('❌ getHistory error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/history
 */
exports.getAllHistory = async (req, res) => {
  try {
    const userWallet = req.user?.wallet_address?.toLowerCase();
    if (!userWallet) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch all agreements where user is shipper or carrier
    const { data: agreements, error: agError } = await supabase
      .from('agreements')
      .select('onchain_id, shipper_wallet, carrier_wallet, escrow_amount, released_amount, created_at, updated_at')
      .or(`shipper_wallet.eq.${userWallet},carrier_wallet.eq.${userWallet}`);

    if (agError || !agreements || agreements.length === 0) {
      return res.json({ totalPayments: 0, payments: [] });
    }

    const agreementIds = agreements.map(a => a.onchain_id);

    // Fetch deposits and payments in one go (safe)
    let deposits = [], payments = [];
    try {
      const depRes = await supabase
        .from('escrow_history')
        .select('*')
        .in('agreement_onchain_id', agreementIds)
        .order('funded_at', { ascending: false });
      if (depRes.data) deposits = depRes.data;
    } catch (e) { console.warn('escrow_history query error:', e.message); }

    try {
      const payRes = await supabase
        .from('payment_history')
        .select('*')
        .in('agreement_onchain_id', agreementIds)
        .order('paid_at', { ascending: false });
      if (payRes.data) payments = payRes.data;
    } catch (e) { console.warn('payment_history query error:', e.message); }

    const events = [];

    deposits.forEach(d => {
      events.push({
        agreementId: d.agreement_onchain_id,
        type: 'Deposit',
        amount: d.amount,
        amountEth: ethers.formatEther(d.amount || '0'),
        txHash: d.transaction_hash || '—',
        timestamp: d.funded_at,
        status: 'completed',
        description: `Escrow funded for AGR-${String(d.agreement_onchain_id).padStart(4, '0')}`,
      });
    });

    payments.forEach(p => {
      events.push({
        agreementId: p.agreement_onchain_id,
        type: `Payment Release (Milestone ${p.milestone_index + 1})`,
        amount: p.amount,
        amountEth: ethers.formatEther(p.amount || '0'),
        txHash: p.transaction_hash || '—',
        timestamp: p.paid_at,
        status: 'completed',
        description: `Payment to ${p.receiver_wallet} for AGR-${String(p.agreement_onchain_id).padStart(4, '0')}`,
      });
    });

    // Fallback from agreements
    if (events.length === 0) {
      agreements.forEach(ag => {
        const escrowWei = ag.escrow_amount || '0';
        const releasedWei = ag.released_amount || '0';
        if (BigInt(escrowWei) > 0) {
          events.push({
            agreementId: ag.onchain_id,
            type: 'Deposit',
            amount: escrowWei,
            amountEth: ethers.formatEther(escrowWei),
            txHash: '—',
            timestamp: ag.created_at,
            status: 'completed',
            description: `Escrow funded for AGR-${String(ag.onchain_id).padStart(4, '0')}`,
          });
        }
        if (BigInt(releasedWei) > 0) {
          events.push({
            agreementId: ag.onchain_id,
            type: 'Payment Release',
            amount: releasedWei,
            amountEth: ethers.formatEther(releasedWei),
            txHash: '—',
            timestamp: ag.updated_at,
            status: 'completed',
            description: `Payment released for AGR-${String(ag.onchain_id).padStart(4, '0')}`,
          });
        }
      });
    }

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ totalPayments: events.length, payments: events });
  } catch (error) {
    console.error('❌ getAllHistory error:', error);
    res.status(500).json({ error: error.message });
  }
};