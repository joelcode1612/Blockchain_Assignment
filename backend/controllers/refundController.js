// ═══ YON — HISTORY MODULE (refund recording) ═══
// Records a refund executed on-chain into refund_history and updates the
// agreement status, so refunds appear in the transaction history.
const supabase = require('../config/supabase');
const { ethers } = require('ethers');

exports.recordRefund = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { txHash } = req.body;
    const shipperAddress = req.user?.wallet_address?.toLowerCase();

    if (!txHash) {
      return res.status(400).json({ error: 'Missing refund transaction hash' });
    }

    const { data: agreement, error: findError } = await supabase
      .from('agreements')
      .select('*')
      .eq('onchain_id', parseInt(agreementId))
      .maybeSingle();

    if (findError) throw findError;
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    if ((agreement.shipper_wallet || '').toLowerCase() !== shipperAddress) {
      return res
        .status(403)
        .json({ error: 'Only the shipper can record a refund' });
    }
    if (agreement.status === 'Refunded') {
      return res.status(400).json({ error: 'Refund already recorded' });
    }

    const escrowWei = BigInt(agreement.escrow_amount || '0');
    const releasedWei = BigInt(agreement.released_amount || '0');
    const remainingWei = escrowWei - releasedWei;
    if (remainingWei <= 0n) {
      return res.status(400).json({ error: 'No remaining escrow to refund' });
    }

    const { data: existing } = await supabase
      .from('refund_history')
      .select('id')
      .eq('transaction_hash', txHash)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Refund transaction already recorded' });
    }

    const { error: insertError } = await supabase
      .from('refund_history')
      .insert({
        agreement_onchain_id: agreement.onchain_id,
        shipper_wallet: agreement.shipper_wallet,
        amount: remainingWei.toString(),
        transaction_hash: txHash,
        refunded_at: new Date().toISOString(),
      });
    if (insertError) {
      return res.status(500).json({
        error: 'Failed to record refund history',
        details: insertError.message,
      });
    }

    const { error: updateError } = await supabase
      .from('agreements')
      .update({ status: 'Refunded', updated_at: new Date().toISOString() })
      .eq('onchain_id', agreement.onchain_id);
    if (updateError) {
      console.warn(
        '⚠️ [Yon] Failed to update agreement status after refund:',
        updateError.message,
      );
    }

    // ═══ YON — REPUTATION: apply -5 REP penalty for the failed agreement ═══
    try {
      const { data: existingReward } = await supabase
        .from('reputation_history')
        .select('id')
        .eq('agreement_onchain_id', agreement.onchain_id)
        .maybeSingle();

      if (!existingReward) {
        await supabase.from('reputation_history').insert({
          agreement_onchain_id: agreement.onchain_id,
          carrier_wallet: agreement.carrier_wallet,
          amount: -5,
          transaction_hash: txHash,
          rewarded_at: new Date().toISOString(),
        });

        const carrierWallet = (agreement.carrier_wallet || '').toLowerCase();
        const { data: carrierUser } = await supabase
          .from('users')
          .select('reputation_balance')
          .eq('wallet_address', carrierWallet)
          .maybeSingle();
        const currentBalance = Number(carrierUser?.reputation_balance ?? 100);
        const newBalance = Math.max(0, currentBalance - 5);
        await supabase
          .from('users')
          .update({ reputation_balance: newBalance })
          .eq('wallet_address', carrierWallet);
      } else {
        console.warn('⚠️ [Yon] Reputation already settled for agreement', agreement.onchain_id, '- skipping penalty.');
      }
    } catch (e) {
      console.warn('⚠️ [Yon] refund reputation penalty skipped:', e.message);
    }
    // ═══ YON End ═══

    res.status(200).json({
      message: 'Refund recorded successfully',
      agreementId: agreement.onchain_id,
      amountWei: remainingWei.toString(),
      amountEth: ethers.formatEther(remainingWei),
      txHash,
    });
  } catch (error) {
    console.error('❌ [Yon] recordRefund error:', error);
    res.status(500).json({ error: error.message });
  }
};
// ═══ YON End ═══
