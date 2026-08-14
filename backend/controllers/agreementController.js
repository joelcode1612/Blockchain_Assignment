const { ethers } = require('ethers');
const supabase = require('../config/supabase');
const blockchainService = require('../services/blockchainService');

/**
 * GET /api/agreements
 * Returns all agreements with shipper/carrier addresses and progress
 */
exports.getAgreements = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agreements')
      .select(`
        onchain_id,
        total_amount,
        status,
        shipper:users!agreements_shipper_id_fkey(wallet_address),
        carrier:users!agreements_carrier_id_fkey(wallet_address),
        milestones (verified, paid)
      `)
      .order('onchain_id', { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch agreements' });
    }

    const agreements = data.map(ag => {
      const milestones = ag.milestones || [];
      const total = milestones.length;
      const paid = milestones.filter(m => m.paid).length;
      const progress = total > 0 ? Math.round((paid / total) * 100) : 0;

      return {
        onchain_id: ag.onchain_id,
        shipper: ag.shipper?.wallet_address || 'N/A',
        carrier: ag.carrier?.wallet_address || 'N/A',
        total_amount: ag.total_amount,
        status: ag.status || 'pending',
        progress: progress
      };
    });

    res.json(agreements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/agreements/create
 * Creates a new agreement and funds the escrow
 */
exports.createAndFundAgreement = async (req, res) => {
  try {
    const { carrier, totalAmountEth, descriptions, percentages, deadlineDays } = req.body;
    const shipperAddress = req.user.wallet_address;

    if (!carrier || !totalAmountEth || !descriptions || !percentages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const totalAmount = ethers.parseEther(totalAmountEth.toString());
    const deadline = Math.floor(Date.now() / 1000) + (deadlineDays || 30) * 24 * 60 * 60;

    const receipt = await blockchainService.createAgreement(
      carrier,
      totalAmount,
      deadline,
      descriptions,
      percentages,
      shipperAddress
    );

    const counter = await blockchainService.getAgreementCounter();
    const agreementId = Number(counter) - 1;

    const depositReceipt = await blockchainService.depositEscrow(
      agreementId,
      totalAmount,
      shipperAddress
    );

    res.status(200).json({
      message: 'Agreement created and funded successfully',
      agreementId,
      createTx: receipt.transactionHash,
      depositTx: depositReceipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};