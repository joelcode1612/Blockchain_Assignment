const supabase = require("../config/supabase");

// =====================================================
// GET ALL AGREEMENTS
// =====================================================

const findAll = async () => {
  const { data, error } = await supabase
    .from("agreements")
    .select(
      `
      *,
      shipper:users!agreements_shipper_fkey(
        wallet_address,
        display_name,
        role
      ),
      carrier:users!agreements_carrier_fkey(
        wallet_address,
        display_name,
        role
      ),
      milestones(
        id,
        milestone_index,
        description,
        payment_percentage,
        status,
        submitted_at,
        verified_at,
        paid_at
      )
    `,
    )
    .order("onchain_id", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data;
};

// =====================================================
// GET AGREEMENT BY ONCHAIN ID
// =====================================================

const findByOnchainId = async (onchainId) => {
  const { data, error } = await supabase
    .from("agreements")
    .select(
      `
      *,
      shipper:users!agreements_shipper_fkey(
        wallet_address,
        display_name,
        role
      ),
      carrier:users!agreements_carrier_fkey(
        wallet_address,
        display_name,
        role
      ),
      milestones(
        id,
        milestone_index,
        description,
        payment_percentage,
        status,
        submitted_at,
        verified_at,
        paid_at
      )
    `,
    )
    .eq("onchain_id", onchainId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// =====================================================
// CREATE AGREEMENT
// =====================================================

const create = async ({
  onchainId,
  shipperWallet,
  carrierWallet,
  escrowAmount,
  deadline,
  status = "PendingAcceptance",
}) => {
  const { data, error } = await supabase
    .from("agreements")
    .insert({
      onchain_id: onchainId,

      shipper_wallet: shipperWallet.toLowerCase(),

      carrier_wallet: carrierWallet.toLowerCase(),

      escrow_amount: escrowAmount.toString(),

      deadline,

      status,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

// =====================================================
// CREATE MILESTONES
// =====================================================

const createMilestones = async ({
  agreementOnchainId,
  descriptions,
  percentages,
}) => {
  const milestones = descriptions.map((description, index) => ({
    agreement_onchain_id: agreementOnchainId,

    milestone_index: index,

    description: description,

    payment_percentage: Number(percentages[index]),

    status: "Pending",
  }));

  const { data, error } = await supabase
    .from("milestones")
    .insert(milestones)
    .select();

  if (error) {
    throw error;
  }

  return data;
};

// =====================================================
// UPDATE AGREEMENT STATUS
// =====================================================

const updateStatus = async (onchainId, status) => {
  const { data, error } = await supabase
    .from("agreements")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("onchain_id", onchainId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

module.exports = {
  findAll,
  findByOnchainId,
  create,
  createMilestones,
  updateStatus,
};
