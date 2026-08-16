// backend/controllers/historyController.js
const supabase = require('../config/supabase');

async function findAgreementByIdentifier(identifier) {
  let { data, error } = await supabase
    .from('agreements')
    .select('*')
    .eq('onchain_id', parseInt(identifier))
    .maybeSingle();
  if (data) return data;

  const { data: uuidData, error: uuidError } = await supabase
    .from('agreements')
    .select('*')
    .eq('id', identifier)
    .maybeSingle();
  return uuidData;
}

exports.getHistory = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const agreement = await findAgreementByIdentifier(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    const { data: escrow } = await supabase
      .from('escrows')
      .select('id')
      .eq('agreement_id', agreement.id)
      .single();

    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('escrow_id', escrow.id)
      .order('paid_at', { ascending: false });

    res.json({
      agreementId: agreement.onchain_id,
      totalPayments: payments.length,
      payments
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};