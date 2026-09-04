const { ethers } = require("ethers");

const agreementModel = require("../models/agreementModel");
const escrowService = require("./escrowService");

// =====================================================
// GET ALL AGREEMENTS
// =====================================================

const getAllAgreements = async () => {
  console.log("🔥 getAllAgreements CALLED");

  const agreements = await agreementModel.findAll();

  console.log(
    "🔥 agreements from DB:",
    agreements.map(a => ({
      onchain_id: a.onchain_id,
      status: a.status,
      escrow_amount: a.escrow_amount,
      released_amount: a.released_amount
    }))
  );

  // Sync agreement data from blockchain before returning dashboard data
  await Promise.all(
    agreements.map(async (agreement) => {
      try {
        await syncAgreementFromBlockchain(agreement.onchain_id);
      } catch (error) {
        console.error(
          `⚠️ Failed to sync agreement ${agreement.onchain_id}:`,
          error.message
        );
      }
    })
  );

  // Reload agreements after blockchain sync
  const syncedAgreements = await agreementModel.findAll();

  return syncedAgreements.map((agreement) => {
    const milestones = agreement.milestones || [];
    const total = milestones.length;

    // IMPORTANT: Your milestone table uses status, not paid / verified boolean fields.
    const paid = milestones.filter(
      (milestone) => milestone.status === "Paid",
    ).length;

    const progress = total > 0 ? Math.round((paid / total) * 100) : 0;

    return {
      onchain_id: agreement.onchain_id,

      // ✅ ADDED: Include the new agreement name
      agreement_name: agreement.agreement_name || "Logistics Agreement",

      shipper:
        agreement.shipper?.display_name ||
        agreement.shipper?.wallet_address ||
        "N/A",
      carrier:
        agreement.carrier?.display_name ||
        agreement.carrier?.wallet_address ||
        "N/A",

      // ✅ ADDED: Convert Wei to ETH for the frontend dashboard
      total_amount_eth: ethers.formatEther(agreement.escrow_amount.toString()),

      released_amount_eth: ethers.formatEther(
        String(agreement.released_amount || 0)
      ),

      status: agreement.status || "PendingAcceptance",
      deadline: agreement.deadline,
      progress,
      milestone_count: total,
      paid_count: paid,
    };
  });
};

// =====================================================
// GET SINGLE AGREEMENT
// =====================================================

const getAgreementById = async (agreementId) => {
  console.log(`🔄 Syncing agreement ${agreementId} before loading...`);

  try {
    await syncAgreementFromBlockchain(agreementId);
    console.log(`✅ Sync completed for agreement ${agreementId}`);
  } catch (error) {
    console.error(
      `⚠️ Blockchain sync failed for agreement ${agreementId}:`,
      error
    );

    // Don't completely break the page if blockchain RPC fails.
    // We can still return the last known DB state.
  }

  return await agreementModel.findByOnchainId(agreementId);
};

// =====================================================
// CREATE AGREEMENT
//
// IMPORTANT:
// This ONLY creates the agreement.
// It DOES NOT fund escrow.
//
// Blockchain transaction is performed
// by the user's MetaMask on frontend.
// =====================================================

const createAgreement = async ({
  onchainId,
  shipperAddress,
  carrierAddress,
  totalAmountEth,
  deadlineTimestamp,
  descriptions,
  percentages,
  createTx,
  cargoType,
  weightKg,
  agreementName,
}) => {
  // ---------------------------------------------
  // Validate amount
  // ---------------------------------------------

  if (!totalAmountEth || Number(totalAmountEth) <= 0) {
    throw new Error("Agreement amount must be greater than 0");
  }

  // ---------------------------------------------
  // Validate carrier
  // ---------------------------------------------

  if (!ethers.isAddress(carrierAddress)) {
    throw new Error("Invalid carrier wallet address");
  }

  // ---------------------------------------------
  // Validate shipper
  // ---------------------------------------------

  if (!ethers.isAddress(shipperAddress)) {
    throw new Error("Invalid shipper wallet address");
  }

  // ---------------------------------------------
  // Validate milestones
  // ---------------------------------------------

  if (!Array.isArray(descriptions) || !Array.isArray(percentages)) {
    throw new Error("Invalid milestone data");
  }

  if (descriptions.length === 0 || descriptions.length !== percentages.length) {
    throw new Error("Invalid milestone configuration");
  }

  const totalPercentage = percentages.reduce(
    (sum, value) => sum + Number(value),
    0,
  );

  if (totalPercentage !== 100) {
    throw new Error("Milestone percentages must total 100%");
  }

  // ---------------------------------------------
  // Convert ETH to Wei
  // ---------------------------------------------

  const totalAmountWei = ethers.parseEther(totalAmountEth.toString());

  // ---------------------------------------------
  // Convert deadline
  //
  // Database expects timestamp with timezone.
  // ---------------------------------------------

  const deadline = new Date(Number(deadlineTimestamp) * 1000).toISOString();

  // ---------------------------------------------
  // Save agreement
  //
  // Initial state:
  // PendingAcceptance
  // ---------------------------------------------

  const agreement = await agreementModel.create({
    onchainId,
    shipperWallet: shipperAddress,
    carrierWallet: carrierAddress,
    escrowAmount: totalAmountWei,
    deadline,
    status: "PendingAcceptance",
    cargoType,
    weightKg,
    agreementName,
  });

  // ---------------------------------------------
  // Save milestones
  // ---------------------------------------------

  await agreementModel.createMilestones({
    agreementOnchainId: onchainId,

    descriptions,

    percentages,
  });

  return {
    agreement,

    agreementId: onchainId,

    createTx,

    totalAmount: totalAmountWei,

    deadline,
  };
};

// =====================================================
// ACCEPT AGREEMENT
//
// Blockchain acceptance should already have
// happened through MetaMask.
// Backend only synchronizes the state.
// =====================================================

const acceptAgreement = async (agreementId, carrierAddress, acceptTx) => {
  const agreement = await agreementModel.findByOnchainId(agreementId);

  if (!agreement) {
    throw new Error("Agreement not found");
  }

  if (agreement.carrier_wallet.toLowerCase() !== carrierAddress.toLowerCase()) {
    throw new Error("Only the assigned carrier can accept this agreement");
  }

  if (agreement.status !== "PendingAcceptance") {
    throw new Error("Agreement is not awaiting acceptance");
  }

  const updated = await agreementModel.updateStatus(
    agreementId,
    "AwaitingFunding",
  );

  return {
    agreement: updated,
    acceptTx,
  };
};

// =====================================================
// REJECT AGREEMENT
// =====================================================

const rejectAgreement = async (agreementId, carrierAddress, rejectTx) => {
  const agreement = await agreementModel.findByOnchainId(agreementId);

  if (!agreement) {
    throw new Error("Agreement not found");
  }

  if (agreement.carrier_wallet.toLowerCase() !== carrierAddress.toLowerCase()) {
    throw new Error("Only the assigned carrier can reject this agreement");
  }

  if (agreement.status !== "PendingAcceptance") {
    throw new Error("Agreement is not awaiting acceptance");
  }

  const updated = await agreementModel.updateStatus(agreementId, "Rejected");

  return {
    agreement: updated,
    rejectTx,
  };
};

// =====================================================
// FUND AGREEMENT
//
// IMPORTANT:
// The ETH transfer itself must happen through
// MetaMask / smart contract.
//
// This function synchronizes the successful
// blockchain funding transaction.
// =====================================================

const fundAgreement = async (agreementId, shipperAddress, fundTx) => {
  const agreement = await agreementModel.findByOnchainId(agreementId);

  if (!agreement) {
    throw new Error("Agreement not found");
  }

  if (agreement.shipper_wallet.toLowerCase() !== shipperAddress.toLowerCase()) {
    throw new Error("Only the shipper can fund this agreement");
  }

  if (agreement.status !== "AwaitingFunding") {
    throw new Error("Agreement is not awaiting funding");
  }

  const updated = await agreementModel.updateStatus(agreementId, "Active");

  return {
    agreement: updated,
    fundTx,
  };
};

const getAvailableAgreements = async () => {
  return await agreementModel.findAvailable();
};

// In agreementService.js
const getAgreementsByWallet = async (walletAddress) => {
  const agreements = await agreementModel.findByWallet(walletAddress);

  console.log(
    "🔄 Syncing agreements for wallet:",
    walletAddress
  );

  await Promise.all(
    agreements.map(async (agreement) => {
      try {
        await syncAgreementFromBlockchain(agreement.onchain_id);
      } catch (error) {
        console.error(
          `⚠️ Failed to sync agreement ${agreement.onchain_id}:`,
          error.message
        );
      }
    })
  );

  // Get fresh data after blockchain sync
  return await agreementModel.findByWallet(walletAddress);
};

// =====================================================
// SYNC AGREEMENT FROM BLOCKCHAIN
// =====================================================

const syncAgreementFromBlockchain = async (agreementId) => {
  console.log(`🔄 Syncing agreement ${agreementId} from blockchain...`);

  // ---------------------------------------------
  // Get agreement from blockchain
  // ---------------------------------------------

  const blockchainAgreement =
    await escrowService.getAgreement(agreementId);
  console.log("🔥 BACKEND getAgreement RESULT:");
  console.log(blockchainAgreement);
  console.log(
    "🔥 keys:",
    Object.keys(blockchainAgreement || {})
  );

  console.log("========== DEBUG AGREEMENT SYNC ==========");
  console.log("Agreement ID:", agreementId);
  console.log("Blockchain status:", Number(blockchainAgreement.status));
  console.log("Blockchain escrowAmountWei:", blockchainAgreement.escrowAmountWei);
  console.log("Blockchain releasedAmountWei:", blockchainAgreement.releasedAmountWei);
  console.log(
    "Blockchain released ETH:",
    ethers.formatEther(String(blockchainAgreement.releasedAmountWei))
  );
  console.log("==========================================");

  // ─── Sync agreement-level blockchain data to DB ───
  const blockchainStatusMap = {
    0: "PendingAcceptance",
    1: "AwaitingFunding",
    2: "Active",
    3: "Completed",
    4: "Rejected",
    5: "Cancelled",
    6: "Refunded",
    7: "Expired",
  };

  const blockchainStatus =
    blockchainStatusMap[Number(blockchainAgreement.status)];

  let effectiveStatus = blockchainStatus;

  const deadline = Number(blockchainAgreement.deadline);

  if (
    (blockchainStatus === "Active" ||
      blockchainStatus === "AwaitingFunding") &&
    deadline > 0 &&
    Date.now() > deadline * 1000
  ) {
    effectiveStatus = "Expired";
  }

  if (effectiveStatus) {
    await agreementModel.updateAgreementFromBlockchain(
      agreementId,
      {
        status: effectiveStatus,
        escrow_amount: String(blockchainAgreement.escrowAmountWei),
        released_amount: String(blockchainAgreement.releasedAmountWei),
      });
    
    console.log("========== AFTER DB UPDATE ==========");
    console.log("DB update finished successfully");
    console.log("====================================");
    console.log(`💾 Agreement ${agreementId} DB synced`);
  }

  console.log(
    "⛓️ Blockchain agreement:",
    blockchainAgreement
  );

  // ---------------------------------------------
  // Sync agreement status
  // ---------------------------------------------

  // We will map blockchain status later if needed.
  // For now, don't blindly overwrite DB status.

  // ---------------------------------------------
  // Get milestone count
  // ---------------------------------------------

  const milestoneCount =
    Number(blockchainAgreement.milestoneCount);

  // ---------------------------------------------
  // Sync every milestone
  // ---------------------------------------------

  for (let i = 0; i < milestoneCount; i++) {
    const m = await escrowService.getMilestone(
      agreementId,
      i
    );

    console.log(`Blockchain milestone ${i}:`, m);

    /*
      Based on the current contract return structure:

      m[0] = milestoneId
      m[1] = paymentPercentage
      m[2] = status
      m[3] = submittedAt
      m[4] = verifiedAt
      m[5] = paymentReleasedAt
    */

    const blockchainStatus = Number(m[2]);

    let status = "Pending";

    if (blockchainStatus === 1) {
      status = "Submitted";
    } else if (blockchainStatus === 2) {
      status = "Verified";
    } else if (blockchainStatus === 3) {
      status = "Paid";
    }

    const submittedAt =
      Number(m[3]) > 0
        ? new Date(Number(m[3]) * 1000).toISOString()
        : null;

    const verifiedAt =
      Number(m[4]) > 0
        ? new Date(Number(m[4]) * 1000).toISOString()
        : null;

    const paidAt =
      Number(m[5]) > 0
        ? new Date(Number(m[5]) * 1000).toISOString()
        : null;

    await agreementModel.updateMilestoneFromBlockchain(
      agreementId,
      i,
      {
        status,
        submitted_at: submittedAt,
        verified_at: verifiedAt,
        paid_at: paidAt,
      }
    );
  }

  console.log(
    `Agreement ${agreementId} blockchain sync complete`
  );

  return blockchainAgreement;
};

module.exports = {
  getAllAgreements,
  getAgreementById,
  createAgreement,
  acceptAgreement,
  rejectAgreement,
  fundAgreement,
  getAvailableAgreements,
  getAgreementsByWallet,
  syncAgreementFromBlockchain,
};
