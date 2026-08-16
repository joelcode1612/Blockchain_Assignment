const supabase = require("../config/supabase");

const User = {
  /**
   * Insert a new user into the database
   */
  async create(walletAddress, role, displayName, email) {
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          wallet_address: walletAddress.toLowerCase(),
          role: role,
          display_name: displayName,
          email: email,
        },
      ])
      .select();

    if (error) {
      throw new Error(error.message);
    }
    return data[0];
  },

  /**
   * Find a user by their wallet address for login
   */
  async findByWallet(walletAddress) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = No rows returned
      throw new Error(error.message);
    }
    return data; // Returns null if user doesn't exist
  },

  /**
   * Get all carriers
   */
  async findAllCarriers() {
    const { data, error } = await supabase
      .from("users")
      .select("wallet_address, display_name, email, role, created_at")
      .eq("role", "Carrier"); 

    if (error) throw new Error(error.message);
    return data || [];
  },
};

module.exports = User;
