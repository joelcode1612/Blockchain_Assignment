const path = require('path');
console.log('Loading supabase from:', path.resolve(__dirname, '../config/supabase.js'));
const supabase = require('../config/supabase.js');
const blockchainService = require('../services/blockchainService');
const { ethers } = require('ethers');

/**
 * Helper: find agreement by onchain_id or UUID
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
 * 1️⃣ VIEW ESCROW BALANCE
 * GET /api/escrow/:agreementId/balance
 */
exports.viewEscrowBalance = async (req, res) => {
  try {
    const { agreementId } = req.params;

    const agreement = await findAgreementByIdentifier(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    const balance = await blockchainService.getEscrowBalance(agreement.onchain_id);

    const { data: escrow } = await supabase
      .from('escrows')
      .select('*')
      .eq('agreement_id', agreement.id)
      .maybeSingle();

    res.json({
      agreementId: agreement.onchain_id,
      remainingWei: balance.toString(),
      remainingEther: ethers.formatEther(balance),
      dbRemaining: escrow?.remaining_amount || '0',
      funded: escrow?.funded || false,
      totalEther: escrow?.total_amount ? ethers.formatEther(escrow.total_amount) : '0'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 2️⃣ DEPOSIT ESCROW
 * POST /api/escrow/:agreementId/deposit
 */
exports.depositEscrow = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { amount } = req.body;
    const shipperAddress = req.user.wallet_address;

    const agreement = await findAgreementByIdentifier(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.status !== 'pending') {
      return res.status(400).json({ error: 'Agreement must be pending' });
    }

    const receipt = await blockchainService.depositEscrow(
      agreement.onchain_id,
      amount,
      shipperAddress
    );

    // Update database
    await supabase
      .from('escrows')
      .insert({
        agreement_id: agreement.id,
        total_amount: amount,
        remaining_amount: amount,
        funded: true,
        deposited_at: new Date().toISOString()
      });

    await supabase
      .from('agreements')
      .update({ status: 'active' })
      .eq('id', agreement.id);

    res.status(200).json({
      message: 'Escrow deposited successfully!',
      receipt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};