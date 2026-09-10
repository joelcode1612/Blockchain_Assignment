const crypto = require("crypto");
const { ethers } = require("ethers");
const supabase = require("../config/supabase");

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
    const recoveredAddress = ethers.verifyMessage(message, signature);

    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
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
        reputation_balance: role === 'Carrier' ? 100 : 0,
        // ═══ YON End ═══
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}

module.exports = AuthService;
