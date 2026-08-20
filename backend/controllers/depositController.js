const path = require('path');
console.log('Loading supabase from:', path.resolve(__dirname, '../config/supabase.js'));
const supabase = require('../config/supabase.js');
const blockchainService = require('../services/escrowService');
const { ethers } = require('ethers');

/**
 * Helper: find agreement by onchain_id (integer) ONLY.
 * No UUID fallback – we use onchain_id as the primary identifier.
 */
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
 * 1️⃣ VIEW ESCROW BALANCE
 * GET /api/escrow/:agreementId/balance
 */
exports.viewEscrowBalance = async (req, res) => {
  try {
    const { agreementId } = req.params;

    // 1. Find the agreement in the database
    const agreement = await findAgreementByOnchainId(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // 2. Read chain_id from the agreement (fallback to Sepolia)
    const chainId = agreement.chain_id || '11155111';

    // 3. Get on‑chain balance from the blockchain service
    const balance = await blockchainService.getEscrowBalance(
      agreement.onchain_id,
      chainId
    );

    // 4. (Optional) Get latest deposit from escrow_history
    const { data: history } = await supabase
      .from('escrow_history')
      .select('amount, funded_at')
      .eq('agreement_onchain_id', agreement.onchain_id)
      .order('funded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Return response
    res.json({
      agreementId: agreement.onchain_id,
      chainId: chainId,
      remainingWei: balance.toString(),
      remainingEther: ethers.formatEther(balance),
      totalDepositedWei: history?.amount || '0',
      totalDepositedEther: history?.amount ? ethers.formatEther(history.amount) : '0',
      lastFundedAt: history?.funded_at || null,
      funded: !!history, // true if there is at least one deposit record
    });
  } catch (error) {
    console.error('❌ viewEscrowBalance error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 2️⃣ DEPOSIT ESCROW
 * POST /api/escrow/:agreementId/deposit
 * 
 * Expects: { amount: string (wei), txHash: string }
 * Updates: status = 'Active', inserts into escrow_history
 */
exports.depositEscrow = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { amount, txHash } = req.body; // amount in wei (string)
    const shipperAddress = req.user.wallet_address?.toLowerCase();

    // 1. Validate input
    if (!amount || !txHash) {
      return res.status(400).json({ error: 'Missing amount or transaction hash' });
    }

    // 2. Find the agreement
    const agreement = await findAgreementByOnchainId(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // 3. Verify shipper is the owner
    if (agreement.shipper_wallet.toLowerCase() !== shipperAddress) {
      return res.status(403).json({ error: 'Only the shipper can deposit' });
    }

    // 4. Check status – must be AwaitingFunding (or PendingAcceptance if you allow)
    if (!['AwaitingFunding', 'PendingAcceptance'].includes(agreement.status)) {
      return res.status(400).json({ 
        error: `Invalid status: ${agreement.status}. Must be AwaitingFunding.` 
      });
    }

    // 5. (Optional) Verify amount matches the expected escrow amount
    //    Compare amount (in wei) with agreement.escrow_amount
    if (amount !== agreement.escrow_amount?.toString()) {
      return res.status(400).json({ 
        error: `Amount mismatch. Expected ${agreement.escrow_amount}, received ${amount}` 
      });
    }

    // 6. Read chain_id (for network selection)
    const chainId = agreement.chain_id || '11155111';

    // 7. (Optional) You can call blockchainService.getEscrowBalance here
    //    to confirm the contract balance increased, but we trust the tx.

    // 8. Insert into escrow_history (not escrows)
    const { error: insertError } = await supabase
      .from('escrow_history')
      .insert({
        agreement_onchain_id: agreement.onchain_id,
        shipper_wallet: shipperAddress,
        amount: amount, // already in wei
        transaction_hash: txHash,
        funded_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('❌ Failed to insert escrow_history:', insertError);
      return res.status(500).json({ error: 'Failed to record deposit history' });
    }

    // 9. Update agreement status to Active
    const { error: updateError } = await supabase
      .from('agreements')
      .update({ 
        status: 'Active',
        updated_at: new Date().toISOString()
      })
      .eq('onchain_id', agreement.onchain_id);

    if (updateError) {
      console.error('❌ Failed to update agreement status:', updateError);
      // Already inserted history, but status update failed – log and return error
      return res.status(500).json({ error: 'Failed to update agreement status' });
    }

    // 10. Success response
    res.status(200).json({
      message: 'Escrow deposited successfully! Agreement is now Active.',
      agreementId: agreement.onchain_id,
      status: 'Active',
      txHash: txHash,
    });

  } catch (error) {
    console.error('❌ depositEscrow error:', error);
    res.status(500).json({ error: error.message });
  }
};