const supabase = require('../config/supabase');
const { ethers } = require('ethers');

/**
 * Find agreement by onchain_id (integer) or UUID.
 */
async function findAgreementByIdentifier(identifier) {
  // Try as onchain_id (integer)
  let { data, error } = await supabase
    .from('agreements')
    .select('*')
    .eq('onchain_id', parseInt(identifier))
    .maybeSingle();
  if (data) return data;

  // Fallback to UUID
  const { data: uuidData, error: uuidError } = await supabase
    .from('agreements')
    .select('*')
    .eq('id', identifier)
    .maybeSingle();
  return uuidData;
}

/**
 * GET /api/history/:agreementId
 * Returns payment history for the agreement, but only if the requesting user
 * is either the shipper or the carrier of that agreement.
 */
exports.getHistory = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const userWallet = req.user.wallet_address.toLowerCase();

    // 1. Fetch the agreement
    const agreement = await findAgreementByIdentifier(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // 2. Authorize: user must be shipper or carrier
    const shipper = agreement.shipper_wallet?.toLowerCase();
    const carrier = agreement.carrier_wallet?.toLowerCase();
    if (shipper !== userWallet && carrier !== userWallet) {
      return res.status(403).json({ error: 'Unauthorized: you are not a party to this agreement' });
    }

    // 3. Try to fetch from 'payments' table (if it exists)
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('agreement_id', agreement.id)   // or .eq('onchain_id', agreement.onchain_id)
      .order('paid_at', { ascending: false });

    if (!paymentsError && payments && payments.length > 0) {
      // Return full payment history
      return res.json({
        agreementId: agreement.onchain_id,
        totalPayments: payments.length,
        payments: payments.map(p => ({
          id: p.id,
          amount: p.amount,          // in wei
          amountEth: ethers.formatEther(p.amount),
          type: p.type || 'release', // deposit, release, refund
          txHash: p.tx_hash,
          status: p.status,
          timestamp: p.paid_at,
        })),
      });
    }

    // 4. Fallback: if no payments table, build minimal history from agreement data
    const escrowWei = agreement.escrow_amount || '0';
    const releasedWei = agreement.released_amount || '0';
    const historyEvents = [];

    // Funded (escrow created)
    if (BigInt(escrowWei) > 0) {
      historyEvents.push({
        type: 'deposit',
        amount: escrowWei,
        amountEth: ethers.formatEther(escrowWei),
        timestamp: agreement.created_at,
        status: 'completed',
        description: 'Escrow funded',
      });
    }

    // Released payments
    if (BigInt(releasedWei) > 0) {
      historyEvents.push({
        type: 'release',
        amount: releasedWei,
        amountEth: ethers.formatEther(releasedWei),
        timestamp: agreement.updated_at,
        status: 'completed',
        description: 'Payment released',
      });
    }

    // Refund (if status is Refunded)
    if (agreement.status === 'Refunded') {
      const refundAmount = BigInt(escrowWei) - BigInt(releasedWei);
      if (refundAmount > 0) {
        historyEvents.push({
          type: 'refund',
          amount: refundAmount.toString(),
          amountEth: ethers.formatEther(refundAmount),
          timestamp: agreement.updated_at,
          status: 'completed',
          description: 'Escrow refunded',
        });
      }
    }

    return res.json({
      agreementId: agreement.onchain_id,
      totalPayments: historyEvents.length,
      payments: historyEvents,
    });

  } catch (error) {
    console.error('❌ History fetch error:', error);
    res.status(500).json({ error: error.message });
  }
};