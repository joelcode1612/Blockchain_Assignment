const path = require("path");
console.log(
  "Loading supabase from:",
  path.resolve(__dirname, "../config/supabase.js"),
);
const supabase = require("../config/supabase.js");
const blockchainService = require("../services/escrowService");
const { ethers } = require("ethers");

/**
 * Helper: find agreement by onchain_id (integer) ONLY.
 */
async function findAgreementByOnchainId(onchainId) {
  const { data, error } = await supabase
    .from("agreements")
    .select("*")
    .eq("onchain_id", parseInt(onchainId))
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * 1️⃣ VIEW ESCROW BALANCE
 * GET /api/escrow/:agreementId/balance
 */
exports.viewEscrowBalance = async (req, res) => {
  try {
    const { agreementId } = req.params;

    const agreement = await findAgreementByOnchainId(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    // ─── Use the agreement's chain_id (not to be confused with onchain_id) ──
    const chainId = agreement.chain_id || "11155111"; // fallback to Sepolia

    const balance = await blockchainService.getEscrowBalance(
      agreement.onchain_id,
      chainId
    );

    // Get the latest deposit record from escrow_history
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
      totalDepositedEther: history?.amount
        ? ethers.formatEther(history.amount)
        : "0",
      lastFundedAt: history?.funded_at || null,
      funded: !!history, // true if at least one deposit exists
    });
  } catch (error) {
    console.error("❌ viewEscrowBalance error:", error);
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
    const { amount, txHash } = req.body; // amount in wei (string or BigInt)
    const shipperAddress = req.user.wallet_address?.toLowerCase();

    // ─── 1. Validate input ──────────────────────────────────────
    if (!amount || !txHash) {
      return res.status(400).json({ error: "Missing amount or transaction hash" });
    }

    // ─── 2. Find agreement ──────────────────────────────────────
    const agreement = await findAgreementByOnchainId(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    // ─── 3. Verify shipper ──────────────────────────────────────
    if (agreement.shipper_wallet.toLowerCase() !== shipperAddress) {
      return res.status(403).json({ error: "Only the shipper can deposit" });
    }

    // ─── 4. Check status ────────────────────────────────────────
    if (!["AwaitingFunding", "PendingAcceptance"].includes(agreement.status)) {
      return res.status(400).json({
        error: `Invalid status: ${agreement.status}. Must be AwaitingFunding.`,
      });
    }

    // ─── 5. Verify amount matches expected escrow ──────────────
    const expectedAmount = agreement.escrow_amount?.toString();
    if (amount.toString() !== expectedAmount) {
      return res.status(400).json({
        error: `Amount mismatch. Expected ${expectedAmount}, received ${amount}`,
      });
    }

    // ─── 6. Get chain_id (used by blockchain service) ──────────
    const chainId = agreement.chain_id || "11155111";

    // ─── 7. Insert into escrow_history ──────────────────────────
    const insertData = {
      agreement_onchain_id: agreement.onchain_id,
      shipper_wallet: shipperAddress,
      amount: amount.toString(), // ✅ convert to string for Supabase numeric
      transaction_hash: txHash,
      funded_at: new Date().toISOString(),
    };

    console.log("📝 Inserting escrow_history:", insertData);

    const { data, error: insertError } = await supabase
      .from("escrow_history")
      .insert(insertData)
      .select();

    if (insertError) {
      console.error("❌ Supabase insert error:", insertError);
      return res.status(500).json({
        error: "Failed to record deposit history",
        details: insertError.message,
        code: insertError.code,
      });
    }

    // ─── 8. Update agreement status to Active ────────────────────
    const { error: updateError } = await supabase
      .from("agreements")
      .update({
        status: "Active",
        updated_at: new Date().toISOString(),
      })
      .eq("onchain_id", agreement.onchain_id);

    if (updateError) {
      console.error("❌ Supabase update error:", updateError);
      // Insert succeeded but status update failed – you may want to rollback or alert.
      return res.status(500).json({
        error: "Failed to update agreement status",
        details: updateError.message,
      });
    }

    // ─── 9. Success ──────────────────────────────────────────────
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