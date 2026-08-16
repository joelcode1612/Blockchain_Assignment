// backend/controllers/historyController.js

// ─── Get history for a specific agreement ──────────────────
exports.getHistory = async (req, res) => {
  try {
    const { agreementId } = req.params;
    // ... existing logic (use findAgreementByIdentifier) ...
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── (Optional) Get history for all agreements of the user ─
exports.getAllHistory = async (req, res) => {
  try {
    const walletAddress = req.user.wallet_address;

    // Fetch all escrows where the user is either shipper or carrier
    const { data: agreements } = await supabase
      .from('agreements')
      .select(`
        id,
        onchain_id,
        shipper:users!agreements_shipper_id_fkey(wallet_address),
        carrier:users!agreements_carrier_id_fkey(wallet_address)
      `)
      .or(`shipper_id.eq.${req.user.id},carrier_id.eq.${req.user.id}`);

    if (!agreements || agreements.length === 0) {
      return res.json({ payments: [] });
    }

    // Get escrow IDs for all these agreements
    const agreementIds = agreements.map(a => a.id);
    const { data: escrows } = await supabase
      .from('escrows')
      .select('id, agreement_id')
      .in('agreement_id', agreementIds);

    if (!escrows || escrows.length === 0) {
      return res.json({ payments: [] });
    }

    const escrowIds = escrows.map(e => e.id);
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .in('escrow_id', escrowIds)
      .order('paid_at', { ascending: false });

    // Optionally, add agreement info to each payment
    const paymentsWithAgreement = payments.map(p => {
      const escrow = escrows.find(e => e.id === p.escrow_id);
      const agreement = agreements.find(a => a.id === escrow?.agreement_id);
      return {
        ...p,
        agreementId: agreement?.onchain_id || null
      };
    });

    res.json({
      totalPayments: paymentsWithAgreement.length,
      payments: paymentsWithAgreement
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};