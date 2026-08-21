const path = require("path");
console.log(
  "Loading supabase from:",
  path.resolve(__dirname, "../config/supabase.js"),
);
const supabase = require("../config/supabase.js");
const escrowService = require("../services/escrowService");
const { ethers } = require("ethers");

// ─── Helper: find agreement by onchain_id ──────────────────
async function findAgreementByOnchainId(onchainId) {
  const { data, error } = await supabase
    .from("agreements")
    .select("*")
    .eq("onchain_id", parseInt(onchainId))
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── 1️⃣ View Escrow Balance ──────────────────────────────
exports.viewEscrowBalance = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const agreement = await findAgreementByOnchainId(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }
    const chainId = agreement.chain_id;
    const balance = await escrowService.getEscrowBalance(
      agreement.onchain_id,
      chainId
    );
    const { data: history } = await supabase
      .from("escrow_history")
      .select("amount, funded_at")
      .eq("agreement_onchain_id", agreement.onchain_id)
      .order("funded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({
      agreementId: agreement.onchain_id,
      chainId: chainId,
      remainingWei: balance.toString(),
      remainingEther: ethers.formatEther(balance),
      totalDepositedWei: history?.amount || "0",
      totalDepositedEther: history?.amount ? ethers.formatEther(history.amount) : "0",
      lastFundedAt: history?.funded_at || null,
      funded: !!history,
    });
  } catch (error) {
    console.error("❌ viewEscrowBalance error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── 2️⃣ Deposit Escrow (with full debugging) ──────────────
exports.depositEscrow = async (req, res) => {
  try {
    console.log("🔍 [depositEscrow] Called with params:", req.params);
    console.log("🔍 [depositEscrow] Request body:", req.body);
    console.log("🔍 [depositEscrow] User:", req.user);

    const { agreementId } = req.params;
    const { amount, txHash } = req.body;
    const shipperAddress = req.user?.wallet_address?.toLowerCase();

    // ─── Validate input ──────────────────────────────────────
    if (!amount || !txHash) {
      console.warn("⚠️ Missing amount or txHash");
      return res.status(400).json({ error: "Missing amount or transaction hash" });
    }

    // ─── Find agreement ──────────────────────────────────────
    const agreement = await findAgreementByOnchainId(agreementId);
    if (!agreement) {
      console.error(`❌ Agreement with onchain_id ${agreementId} not found in database.`);
      return res.status(404).json({ error: "Agreement not found in database" });
    }
    console.log("✅ Agreement found:", agreement);

    // ─── Verify shipper ──────────────────────────────────────
    if (agreement.shipper_wallet.toLowerCase() !== shipperAddress) {
      console.warn(`⚠️ Shipper mismatch: DB=${agreement.shipper_wallet}, request=${shipperAddress}`);
      return res.status(403).json({ error: "Only the shipper can deposit" });
    }

    // ─── Check status ────────────────────────────────────────
    const allowedStatuses = ["AwaitingFunding", "PendingAcceptance"];
    if (!allowedStatuses.includes(agreement.status)) {
      console.warn(`⚠️ Invalid status: ${agreement.status}`);
      return res.status(400).json({
        error: `Invalid status: ${agreement.status}. Must be AwaitingFunding or PendingAcceptance.`,
      });
    }

    // ─── Verify amount ──────────────────────────────────────
    const expectedAmount = agreement.escrow_amount?.toString().trim();
    const receivedAmount = amount.toString().trim();
    if (receivedAmount !== expectedAmount) {
      console.warn(`⚠️ Amount mismatch: expected ${expectedAmount}, received ${receivedAmount}`);
      return res.status(400).json({
        error: `Amount mismatch. Expected ${expectedAmount}, received ${receivedAmount}`,
      });
    }

    // ─── Check duplicate transaction hash ──────────────────
    const { data: existing, error: dupError } = await supabase
      .from("escrow_history")
      .select("id")
      .eq("transaction_hash", txHash)
      .maybeSingle();

    if (dupError) {
      console.error("❌ Error checking duplicate hash:", dupError);
      return res.status(500).json({ error: "Database error while checking duplicate" });
    }
    if (existing) {
      console.warn(`⚠️ Duplicate transaction hash: ${txHash}`);
      return res.status(409).json({ error: "Transaction already recorded." });
    }

    // ─── Prepare insert data ─────────────────────────────────
    const insertData = {
      agreement_onchain_id: agreement.onchain_id,
      shipper_wallet: shipperAddress,
      amount: receivedAmount, // already string
      transaction_hash: txHash,
      funded_at: new Date().toISOString(),
    };

    console.log("📝 Inserting escrow_history:", insertData);

    // ─── Execute insert ──────────────────────────────────────
    const { error: insertError } = await supabase
      .from("escrow_history")
      .insert(insertData);

    if (insertError) {
      console.error("❌ Supabase insert error:", insertError);
      return res.status(500).json({
        error: "Failed to record deposit history",
        details: insertError.message,
        code: insertError.code,
      });
    }

    console.log("✅ Insert succeeded.");

    // ─── Update agreement status ─────────────────────────────
    const { error: updateError } = await supabase
      .from("agreements")
      .update({
        status: "Active",
        updated_at: new Date().toISOString(),
      })
      .eq("onchain_id", agreement.onchain_id);

    if (updateError) {
      console.error("❌ Supabase update error:", updateError);
      // Insert succeeded but status update failed – we still return success because the deposit is recorded
      return res.status(500).json({
        error: "Failed to update agreement status",
        details: updateError.message,
      });
    }

    console.log(`✅ Deposit recorded for agreement ${agreement.onchain_id}`);
    res.status(200).json({
      message: "Escrow deposited successfully! Agreement is now Active.",
      agreementId: agreement.onchain_id,
      status: "Active",
      txHash: txHash,
    });
  } catch (error) {
    console.error("❌ depositEscrow error:", error);
    res.status(500).json({ error: error.message });
  }
};