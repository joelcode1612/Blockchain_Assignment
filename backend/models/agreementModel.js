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
// CREATE AGREEMENT (with duplicate check)
// =====================================================

const create = async ({
  onchainId,
  shipperWallet,
  carrierWallet,
  escrowAmount,
  deadline,
  status = "PendingAcceptance",
  cargoType,
  weightKg,
}) => {
  // ------------------------------------------------------------------
  // 🔍 Check if an agreement with this onchain_id already exists
  // ------------------------------------------------------------------
  const { data: existing, error: findError } = await supabase
    .from("agreements")
    .select("*")
    .eq("onchain_id", onchainId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  // ------------------------------------------------------------------
  // ✅ Already exists – return it without inserting again
  // ------------------------------------------------------------------
  if (existing) {
    console.log(`⚠️ Agreement ${onchainId} already exists in database.`);
    return {
      success: true,
      alreadyExists: true,
      agreement: existing,
    };
  }

  // ------------------------------------------------------------------
  // ➕ Insert new agreement
  // ------------------------------------------------------------------
  const { data: agreement, error } = await supabase
    .from("agreements")
    .insert({
      onchain_id: onchainId,
      shipper_wallet: shipperWallet.toLowerCase(),
      carrier_wallet: carrierWallet.toLowerCase(),
      escrow_amount: escrowAmount.toString(),
      released_amount: "0",
      deadline,
      status,
      cargo_type: cargoType, // ✅ new
      weight_kg: weightKg, // ✅ new
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    success: true,
    alreadyExists: false,
    agreement,
  };
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

// =====================================================
// GET AVAILABLE AGREEMENTS (PendingAcceptance)
// =====================================================

const findAvailable = async () => {
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
    .eq("status", "PendingAcceptance") // only those awaiting carrier acceptance
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

// Don't forget to export it:
module.exports = {
  findAll,
  findByOnchainId,
  create,
  createMilestones,
  updateStatus,
  findAvailable,
};
