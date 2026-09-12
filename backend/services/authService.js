const crypto = require("crypto");
const { ethers } = require("ethers");
const supabase = require("../config/supabase");

const NONCE_TTL_MS = 5 * 60 * 1000;
const nonces = new Map();

class AuthService {
  static generateNonce(address) {
    const key = address.toLowerCase();
    const value = crypto.randomBytes(16).toString("hex");
    nonces.set(key, { value, expiresAt: Date.now() + NONCE_TTL_MS });
    return value;
  }
  static getNonce(address) {
    const key = address.toLowerCase();
    const entry = nonces.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      nonces.delete(key);
      return null;
    }
    return entry.value;
  }
  static deleteNonce(address) {
    nonces.delete(address.toLowerCase());
  }
  static verifySignature(message, signature, expectedAddress) {
    try {
      const recovered = ethers.verifyMessage(message, signature);
      return recovered.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error("❌ Signature recovery failed:", error.message);
      return false;
    }
  }
  static async getUserByWallet(walletAddress) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  static async createUser(walletAddress, displayName, role, email = null) {
    const { data, error } = await supabase
      .from("users")
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        display_name: displayName,
        role,
        email,
        reputation_balance: role === "Carrier" ? 100 : 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
module.exports = AuthService;
