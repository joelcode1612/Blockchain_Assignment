const supabase = require('../config/supabase');

exports.verifyMilestone = async (req, res) => {
  try {
    const { agreementId, milestoneId, txHash } = req.body;
    const shipperAddress = req.user.wallet_address;

    // ─── Validate inputs ──────────────────────────────────────
    const agId = Number(agreementId);
    const msId = Number(milestoneId);
    if (isNaN(agId) || isNaN(msId)) {
      return res.status(400).json({ error: 'Invalid agreementId or milestoneId' });
    }

    console.log(`🔍 Verifying milestone ${msId} for agreement ${agId}`);

    // ─── Find agreement by onchain_id ──────────────────────────
    const { data: agreement, error: agError } = await supabase
      .from('agreements')
      .select('*')
      .eq('onchain_id', agId)
      .maybeSingle();

    if (agError) {
      console.error('Agreement query error:', agError);
      throw agError;
    }
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // ─── Verify shipper ──────────────────────────────────────────
    if (agreement.shipper_wallet.toLowerCase() !== shipperAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Only the shipper can verify milestones' });
    }

    // ─── Find milestone ──────────────────────────────────────────
    const { data: milestone, error: mError } = await supabase
      .from('milestones')
      .select('*')
      .eq('agreement_onchain_id', agreement.onchain_id)
      .eq('milestone_index', msId)
      .maybeSingle();

    if (mError) {
      console.error('Milestone query error:', mError);
      throw mError;
    }
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // ─── Check status ──────────────────────────────────────────
    if (milestone.status === 'Verified' || milestone.status === 'Paid') {
      return res.status(400).json({ error: `Milestone already ${milestone.status.toLowerCase()}` });
    }

    // ─── Update milestone status to Verified ────────────────────
    const { error: updateError } = await supabase
      .from('milestones')
      .update({
        status: 'Verified',
        verified_at: new Date().toISOString()
      })
      .eq('id', milestone.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    res.status(200).json({
      message: 'Milestone verified successfully',
      milestoneId: milestone.milestone_index,
      agreementId: agreement.onchain_id,
      txHash: txHash
    });
  } catch (error) {
    console.error('❌ verifyMilestone error:', error);
    res.status(500).json({ error: error.message });
  }
};