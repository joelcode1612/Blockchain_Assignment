const { ethers } = require("ethers");

const agreementModel = require("../models/agreementModel");

// =====================================================
// GET ALL AGREEMENTS
// =====================================================

const getAllAgreements = async () => {
  const agreements = await agreementModel.findAll();

  return agreements.map((agreement) => {
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
  return await agreementModel.findByWallet(walletAddress);
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
};
