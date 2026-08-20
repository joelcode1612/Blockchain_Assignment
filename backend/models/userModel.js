const supabase = require("../config/supabase");

// Custom error class for database errors (optional)
class DatabaseError extends Error {
  constructor(message, code = null, details = null) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
    this.details = details;
  }
}

const User = {
  /**
   * Insert a new user into the database
   * @param {string} walletAddress - Ethereum wallet address
   * @param {string} role - 'Shipper' or 'Carrier'
   * @param {string} displayName - Display name
   * @param {string} email - Email address (optional)
   * @returns {Promise<object>} Created user object
   * @throws {DatabaseError} If validation fails or database error occurs
   */
  async create(walletAddress, role, displayName, email) {
    // 1. Validate inputs
    if (!walletAddress || typeof walletAddress !== "string") {
      throw new DatabaseError(
        "Wallet address is required and must be a string.",
      );
    }
    if (!role || !["Shipper", "Carrier"].includes(role)) {
      throw new DatabaseError("Role must be either 'Shipper' or 'Carrier'.");
    }
    if (!displayName || typeof displayName !== "string") {
      throw new DatabaseError("Display name is required and must be a string.");
    }
    // email is optional; if provided, ensure it's a string
    if (email !== undefined && typeof email !== "string") {
      throw new DatabaseError("Email must be a string if provided.");
    }

    const wallet = walletAddress.toLowerCase();

    try {
      const { data, error } = await supabase
        .from("users")
        .insert([
          {
            wallet_address: wallet,
            role: role,
            display_name: displayName,
            email: email || null,
          },
        ])
        .select();

      if (error) {
        // Handle specific Supabase error codes
        if (error.code === "23505") {
          // unique violation (wallet_address already exists)
          throw new DatabaseError(
            "A user with this wallet address already exists.",
            error.code,
            error.details,
          );
        }
        if (error.code === "23502") {
          // not null violation (missing required field)
          throw new DatabaseError(
            "Missing required field: " + (error.column || ""),
            error.code,
            error.details,
          );
        }
        // Generic database error
        throw new DatabaseError(
          `Failed to create user: ${error.message}`,
          error.code,
          error.details,
        );
      }

      if (!data || data.length === 0) {
        throw new DatabaseError(
          "User creation succeeded but no data was returned.",
        );
      }

      return data[0];
    } catch (error) {
      // If it's already a DatabaseError, rethrow it
      if (error instanceof DatabaseError) {
        throw error;
      }
      // Catch any unexpected errors (e.g., network issues)
      throw new DatabaseError(
        `Unexpected error creating user: ${error.message}`,
        error.code || null,
        error.details || null,
      );
    }
  },

  /**
   * Find a user by their wallet address
   * @param {string} walletAddress - Ethereum wallet address
   * @returns {Promise<object|null>} User object or null if not found
   * @throws {DatabaseError} If database error occurs
   */
  async findByWallet(walletAddress) {
    if (!walletAddress || typeof walletAddress !== "string") {
      throw new DatabaseError(
        "Wallet address is required and must be a string.",
      );
    }

    const wallet = walletAddress.toLowerCase();

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("wallet_address", wallet)
        .maybeSingle(); // Use maybeSingle to avoid error when no rows

      if (error) {
        // Handle known errors
        if (error.code === "PGRST116") {
          // No rows returned – this is fine, return null
          return null;
        }
        // Other database errors
        throw new DatabaseError(
          `Failed to find user: ${error.message}`,
          error.code,
          error.details,
        );
      }

      return data; // data will be null if not found, or the user object
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Unexpected error finding user: ${error.message}`,
        error.code || null,
        error.details || null,
      );
    }
  },

  /**
   * Update a user's profile fields (e.g. display_name, email)
   * @param {string} walletAddress - Ethereum wallet address
   * @param {object} updates - Fields to update
   * @returns {Promise<object|null>} Updated user object or null if not found
   * @throws {DatabaseError} If database error occurs
   */
  async update(walletAddress, updates) {
    if (!walletAddress || typeof walletAddress !== "string") {
      throw new DatabaseError(
        "Wallet address is required and must be a string.",
      );
    }

    const wallet = walletAddress.toLowerCase();
    const allowed = {};
    if (updates.display_name !== undefined) {
      allowed.display_name = updates.display_name;
    }
    if (updates.email !== undefined) {
      allowed.email = updates.email;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .update({ ...allowed, updated_at: new Date().toISOString() })
        .eq("wallet_address", wallet)
        .select()
        .maybeSingle();

      if (error) {
        throw new DatabaseError(
          `Failed to update user: ${error.message}`,
          error.code,
          error.details,
        );
      }

      return data || null;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Unexpected error updating user: ${error.message}`,
        error.code || null,
        error.details || null,
      );
    }
  },

  /**
   * Get all carriers (users with role 'Carrier')
   * @returns {Promise<Array>} Array of carrier objects
   * @throws {DatabaseError} If database error occurs
   */
  async findAllCarriers() {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("wallet_address, display_name, email, role, created_at")
        .eq("role", "Carrier");

      if (error) {
        throw new DatabaseError(
          `Failed to fetch carriers: ${error.message}`,
          error.code,
          error.details,
        );
      }

      return data || []; // Ensure we always return an array
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Unexpected error fetching carriers: ${error.message}`,
        error.code || null,
        error.details || null,
      );
    }
  },
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
        paid_at
      )
    `
    )
    .or(`shipper_wallet.eq.${walletAddress}, carrier_wallet.eq.${walletAddress}`)
    .order("onchain_id", { ascending: true });

  if (error) throw error;
  return data;
};

module.exports = User;
