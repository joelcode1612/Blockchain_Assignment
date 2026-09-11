const crypto = require("crypto");
const { ethers } = require("ethers");
const supabase = require("../config/supabase");
const path = require("path");

// authService.js lives at:  Blockchain_Assignment/backend/services/authService.js
// ABI lives at:             Blockchain_Assignment/abi/LogisticsEscrow.json
// So we go:                 ../..  → Blockchain_Assignment/
//                           abi/   → abi/
//
// The `.abi` at the end extracts the array from the Hardhat artifact
// (the JSON is an object with a top-level "abi" field).
const CONTRACT_ABI = require(
  path.join(__dirname, "..", "..", "abi", "LogisticsEscrow.json"),
).abi;
// =====================================================
// In-memory nonce store
// =====================================================
//
// ⚠️ In production, use Redis or a DB table instead.
//     In-memory store is lost on server restart.
//
const nonces = new Map();

class AuthService {
  // =====================================================
  // GENERATE NONCE
  // =====================================================

  static generateNonce(address) {
    const nonce = crypto.randomBytes(16).toString("hex");

    nonces.set(address.toLowerCase(), nonce);

    return nonce;
  }

  // =====================================================
  // GET NONCE
  // =====================================================

  static getNonce(address) {
    return nonces.get(address.toLowerCase());
  }

  // =====================================================
  // DELETE NONCE
  // =====================================================

  static deleteNonce(address) {
    nonces.delete(address.toLowerCase());
  }

  // =====================================================
  // VERIFY METAMASK SIGNATURE
  // =====================================================

  static verifySignature(message, signature, expectedAddress) {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);

      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error("❌ verifySignature error:", error.message);
      return false;
    }
  }

  // =====================================================
  // GET USER BY WALLET
  // =====================================================

  static async getUserByWallet(walletAddress) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  // =====================================================
  // CREATE USER
  // =====================================================

  static async createUser(walletAddress, displayName, role, email = null) {
    const { data, error } = await supabase
      .from("users")
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        display_name: displayName,
        role: role,
        email: email,
        // ═══ YON — REPUTATION: carriers start with 100 REP ═══
        reputation_balance: role === "Carrier" ? 100 : 0,
        // ═══ YON End ═══
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // =====================================================
  // 🔷 UPDATE USER PROFILE
  // =====================================================
  //
  // Updates name and email ONLY. Never touches:
  //   - wallet_address (identity)
  //   - role (owned by the blockchain)
  //   - reputation_balance (system-managed)
  //
  // Called when an existing user re-registers (e.g. after a
  // blockchain reset) so their profile can be refreshed without
  // blocking them out.
  //

  static async updateUserProfile(walletAddress, displayName, email = null) {
    const { data, error } = await supabase
      .from("users")
      .update({
        display_name: displayName,
        email: email,
      })
      .eq("wallet_address", walletAddress.toLowerCase())
      .select()
      .single();

    if (error) {
      console.error("❌ updateUserProfile error:", error.message);
      throw error;
    }

    return data;
  }

  // =====================================================
  // 🔷 GET ON-CHAIN ROLE
  // =====================================================
  //
  // Reads the user's role from the blockchain.
  //
  // Returns "Shipper" | "Carrier" | null
  //
  // This is the SOURCE OF TRUTH for the role. Never trust the
  // frontend or the DB for this — always ask the chain.
  //
  // ⚠️  You must set these in your .env:
  //       RPC_URL
  //       CONTRACT_ADDRESS
  //
  // ⚠️  Adjust the enum numbers below to match your Solidity enum.
  //       Common pattern:
  //         enum Role { None, Shipper, Carrier }  //  0      1        2
  //

  static async getOnChainRole(walletAddress) {
    try {
      if (!process.env.RPC_URL) {
        console.warn("⚠️ RPC_URL not set — cannot read on-chain role.");
        return null;
      }

      if (!process.env.CONTRACT_ADDRESS) {
        console.warn(
          "⚠️ CONTRACT_ADDRESS not set — cannot read on-chain role.",
        );
        return null;
      }

      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

      const contract = new ethers.Contract(
        process.env.CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider,
      );

      // 🔷 Changed from getUserRole → getRole
      const roleCode = await contract.getRole(walletAddress);
      const code = Number(roleCode);

      // ═══ ROLE ENUM MAPPING ═══
      //    Verify against your Solidity enum:
      //      enum Role { None, Shipper, Carrier }  →  0, 1, 2
      if (code === 0) return null;
      if (code === 1) return "Shipper";
      if (code === 2) return "Carrier";
      // ═════════════════════════

      console.warn("⚠️ Unknown on-chain role code:", code);
      return null;
    } catch (error) {
      console.error("❌ getOnChainRole failed:", error.message);
      return null;
    }
  }
}

module.exports = AuthService;
