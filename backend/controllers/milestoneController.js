const supabase = require('../config/supabase');
const crypto = require('crypto');

exports.uploadProof = async (req, res) => {
  try {
    const { agreementId, milestoneId } = req.body;
    const carrierAddress = req.user.wallet_address;

    const agId = Number(agreementId);
    const msId = Number(milestoneId);

    if (isNaN(agId) || isNaN(msId)) {
      return res.status(400).json({
        error: 'Invalid agreementId or milestoneId',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Proof photo is required',
      });
    }

    console.log(`📷 Uploading proof for agreement ${agId}, milestone ${msId}`);
    console.log(`📁 File: ${req.file.originalname}`);
    console.log(`📦 Size: ${req.file.size}`);
    console.log(`🖼️ Type: ${req.file.mimetype}`);

    // Find agreement
    const { data: agreement, error: agError } = await supabase
      .from('agreements')
      .select('*')
      .eq('onchain_id', agId)
      .maybeSingle();

    if (agError) throw agError;

    if (!agreement) {
      return res.status(404).json({
        error: 'Agreement not found',
      });
    }

    // Only carrier can upload proof
    if (
      agreement.carrier_wallet.toLowerCase() !==
      carrierAddress.toLowerCase()
    ) {
      return res.status(403).json({
        error: 'Only the carrier can upload milestone proof',
      });
    }

    // Find milestone
    const { data: milestone, error: milestoneError } = await supabase
      .from('milestones')
      .select('*')
      .eq('agreement_onchain_id', agId)
      .eq('milestone_index', msId)
      .maybeSingle();

    if (milestoneError) throw milestoneError;

    if (!milestone) {
      return res.status(404).json({
        error: 'Milestone not found',
      });
    }

    // Only allow proof for Pending milestone
    if (milestone.status !== 'Pending') {
      return res.status(400).json({
        error: `Cannot upload proof for milestone with status ${milestone.status}`,
      });
    }

    // Generate unique filename
    const extension =
      req.file.originalname.split('.').pop()?.toLowerCase() || 'jpg';

    const fileName = `milestone-${msId}-${crypto.randomUUID()}.${extension}`;

    const filePath = `agreement-${agId}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('milestone-proofs')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Supabase Storage upload error:', uploadError);
      throw uploadError;
    }

    console.log(`✅ Proof uploaded: ${filePath}`);

    // Get public URL
    const {
      data: publicUrlData,
    } = supabase.storage
      .from('milestone-proofs')
      .getPublicUrl(filePath);

    const proofUrl = publicUrlData.publicUrl;

    // Save proof URL in database
    const { error: dbError } = await supabase
      .from('milestones')
      .update({
        proof_url: proofUrl,
      })
      .eq('id', milestone.id);

    if (dbError) {
      console.error('❌ Proof URL DB update error:', dbError);
      throw dbError;
    }

    console.log(`✅ Proof URL saved to database`);

    res.status(200).json({
      message: 'Proof uploaded successfully',
      agreementId: agId,
      milestoneId: msId,
      proofUrl,
      filePath,
    });
  } catch (error) {
    console.error('❌ uploadProof error:', error);

    res.status(500).json({
      error: error.message,
    });
  }
};

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