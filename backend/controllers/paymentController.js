const supabase = require('../config/supabase');

/**
 * Helper: find agreement by onchain_id
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
 * POST /api/payment/release
 * Records a milestone payment release into payment_history.
 * Expects: { agreementId, milestoneId, txHash }
 * Also updates milestone status to 'Paid' and checks if all milestones are paid.
 */
exports.recordPaymentRelease = async (req, res) => {
  try {
    const { agreementId, milestoneId, txHash } = req.body;
    const shipperAddress = req.user.wallet_address?.toLowerCase();

    if (!agreementId || milestoneId === undefined || !txHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Get agreement
    const agreement = await findAgreementByOnchainId(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // 2. Verify shipper
    if (agreement.shipper_wallet.toLowerCase() !== shipperAddress) {
      return res.status(403).json({ error: 'Only the shipper can record payments' });
    }

    // 3. Get milestone from DB
    const { data: milestone, error: milestoneError } = await supabase
      .from('milestones')
      .select('*')
      .eq('agreement_onchain_id', agreement.onchain_id)
      .eq('milestone_index', parseInt(milestoneId))
      .maybeSingle();

    if (milestoneError || !milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // 4. Calculate payment amount (in wei)
    const escrowWei = agreement.escrow_amount;
    const percentage = milestone.payment_percentage;
    const amountWei = (BigInt(escrowWei) * BigInt(percentage)) / 100n;

    // 5. Insert into payment_history
    const { error: insertError } = await supabase
      .from('payment_history')
      .insert({
        agreement_onchain_id: agreement.onchain_id,
        milestone_index: parseInt(milestoneId),
        receiver_wallet: agreement.carrier_wallet,
        amount: amountWei.toString(),
        transaction_hash: txHash,
        paid_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('❌ Failed to insert payment_history:', insertError);
      return res.status(500).json({ error: 'Failed to record payment history' });
    }

    // 6. Update milestone status to Paid
    await supabase
      .from('milestones')
      .update({ status: 'Paid', paid_at: new Date().toISOString() })
      .eq('agreement_onchain_id', agreement.onchain_id)
      .eq('milestone_index', parseInt(milestoneId));

    // 7. Check if all milestones are paid → mark agreement as Completed
    const { data: allMilestones } = await supabase
      .from('milestones')
      .select('status')
      .eq('agreement_onchain_id', agreement.onchain_id);

    if (allMilestones && allMilestones.every(m => m.status === 'Paid')) {
      await supabase
        .from('agreements')
        .update({ status: 'Completed', updated_at: new Date().toISOString() })
        .eq('onchain_id', agreement.onchain_id);
    }

    res.status(200).json({
      message: 'Payment release recorded successfully.',
      agreementId: agreement.onchain_id,
      milestoneId: parseInt(milestoneId),
      amount: amountWei.toString(),
      txHash,
    });
  } catch (error) {
    console.error('❌ recordPaymentRelease error:', error);
    res.status(500).json({ error: error.message });
  }
};