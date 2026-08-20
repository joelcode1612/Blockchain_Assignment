const User = require("../models/userModel");

const userController = {
  /**
   * Handle User Registration
   */
  async register(req, res) {
    try {
      const { walletAddress, role, displayName, email } = req.body;

      // 1. Validate required fields
      if (!walletAddress || !role || !displayName) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      // 2. Check if user already exists in DB
      const existingUser = await User.findByWallet(walletAddress);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User already exists in the database",
        });
      }

      // 3. Save to database using Model
      const newUser = await User.create(
        walletAddress,
        role,
        displayName,
        email,
      );

      // 4. Return success
      return res.status(201).json({
        success: true,
        message: "User successfully saved to database",
        user: newUser,
      });
    } catch (error) {
      console.error("Database Registration Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  /**
   * Handle User Login / Fetch Profile
   */
  async getProfile(req, res) {
    try {
      // Authenticated via /api/users/me (req.user from authenticate middleware)
      // or fall back to a wallet address in params/header for direct calls.
      const walletAddress =
        (req.user && req.user.wallet_address) ||
        req.params.walletAddress ||
        req.headers["x-wallet-address"];

      if (!walletAddress) {
        return res
          .status(400)
          .json({ success: false, message: "Wallet address required" });
      }

      const user = req.user || (await User.findByWallet(walletAddress));

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Flatten so the frontend can read userData.display_name directly
      return res.status(200).json({
        success: true,
        ...user,
      });
    } catch (error) {
      console.error("Fetch Profile Error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  /**
   * Update the current user's profile (display_name / email)
   */
  async updateProfile(req, res) {
    try {
      const walletAddress =
        (req.user && req.user.wallet_address) ||
        req.headers["x-wallet-address"];

      if (!walletAddress) {
        return res
          .status(400)
          .json({ success: false, message: "Wallet address required" });
      }

      const { display_name, email } = req.body;
      if (display_name === undefined && email === undefined) {
        return res.status(400).json({
          success: false,
          message: "No fields provided to update",
        });
      }

      const user = await User.update(walletAddress, { display_name, email });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      return res.status(200).json({ success: true, ...user });
    } catch (error) {
      console.error("Update Profile Error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  /**
   * Get all registered carriers (for the shipper's carrier dropdown)
   */
  async listCarriers(req, res) {
    try {
      const carriers = await User.findAllCarriers();
      return res.status(200).json(carriers);
    } catch (error) {
      console.error("List carriers error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load carriers" });
    }
  },

  async getCarriers(req, res) {
    try {
      const carriers = await User.findAllCarriers();
      return res.status(200).json(carriers);
    } catch (error) {
      console.error("List carriers error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load carriers" });
    }
  },
};

module.exports = userController;
