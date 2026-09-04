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
        paid_at,
        proof_url
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
        paid_at,
        proof_url
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
  agreementName,
}) => {
  // ... duplicate check ...

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
      cargo_type: cargoType,
      weight_kg: weightKg,
      agreement_name: agreementName,
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
        paid_at,
        proof_url
      )
    `,
    )
    .eq("status", "PendingAcceptance") // only those awaiting carrier acceptance
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

// =====================================================
// GET AGREEMENTS BY WALLET (as shipper OR carrier)
// =====================================================

const findByWallet = async (walletAddress) => {
  // ✅ Correct .or() syntax using template literals
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
        paid_at,
        proof_url
      )
    `,
    )
    .or(
      `shipper_wallet.eq.${walletAddress}, carrier_wallet.eq.${walletAddress}`,
    )
    .order("onchain_id", { ascending: true });

  if (error) throw error;
  return data;
};

// =====================================================
// SYNC MILESTONE FROM BLOCKCHAIN
// =====================================================

const updateMilestoneFromBlockchain = async (
  agreementOnchainId,
  milestoneIndex,
  updates
) => {
  const { data, error } = await supabase
    .from("milestones")
    .update({
      status: updates.status,
      submitted_at: updates.submitted_at,
      verified_at: updates.verified_at,
      paid_at: updates.paid_at,
    })
    .eq("agreement_onchain_id", agreementOnchainId)
    .eq("milestone_index", milestoneIndex)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const updateAgreementFromBlockchain = async (onchainId, updates) => {
  console.log("========== SUPABASE UPDATE ==========");
  console.log("onchainId:", onchainId);
  console.log("updates:", updates);
  console.log("======================================");
  const { data, error } = await supabase
    .from("agreements")
    .update({
      status: updates.status,
      escrow_amount: updates.escrow_amount,
      released_amount: updates.released_amount,
      deadline: updates.deadline,
      updated_at: new Date().toISOString(),
    })
    .eq("onchain_id", onchainId)
    .select()
    .single();

  if (error) {
    console.error("❌ SUPABASE UPDATE ERROR:", error);
    throw error;
  }

  console.log("✅ SUPABASE UPDATE RESULT:", data);

  return data;
};

module.exports = {
  findAll,
  findByOnchainId,
  findByWallet,
  create,
  createMilestones,
  updateStatus,
  updateMilestoneFromBlockchain,
  updateAgreementFromBlockchain,
  findAvailable,
};
