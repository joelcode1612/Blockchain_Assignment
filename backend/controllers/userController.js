const User = require("../models/userModel");

const userController = {
  /**
   * ============================================================
   * GET CURRENT USER PROFILE
   * GET /api/users/me
   *
   * Authentication:
   * - authenticate middleware must run first
   * - authenticated user is available as req.user
   * ============================================================
   */
  async getProfile(req, res) {
    try {
      // The JWT authentication middleware should already
      // identify the current user and attach it to req.user.
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      return res.status(200).json({
        success: true,
        ...req.user,
      });
    } catch (error) {
      console.error("Fetch Profile Error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * ============================================================
   * UPDATE CURRENT USER PROFILE
   * PUT /api/users/me
   *
   * Authentication:
   * - authenticate middleware must run first
   * - wallet address comes from req.user
   * ============================================================
   */
  async updateProfile(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const walletAddress = req.user.wallet_address;

      if (!walletAddress) {
        return res.status(401).json({
          success: false,
          message: "Authenticated wallet address not found",
        });
      }

      const { display_name, email } = req.body;

      // Make sure at least one field is being updated.
      if (display_name === undefined && email === undefined) {
        return res.status(400).json({
          success: false,
          message: "No fields provided to update",
        });
      }

      // Validate display name when supplied.
      if (
        display_name !== undefined &&
        (typeof display_name !== "string" || display_name.trim().length === 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "Display name cannot be empty",
        });
      }

      // Validate email when supplied.
      if (
        email !== undefined &&
        email !== null &&
        email !== "" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
      }

      const updateData = {};

      if (display_name !== undefined) {
        updateData.display_name = display_name.trim();
      }

      if (email !== undefined) {
        updateData.email = email === "" ? null : email.trim();
      }

      const user = await User.update(walletAddress, updateData);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        ...user,
      });
    } catch (error) {
      console.error("Update Profile Error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * ============================================================
   * GET ALL REGISTERED CARRIERS
   * GET /api/users/carriers
   *
   * This can remain independent of the current user's wallet.
   * ============================================================
   */
  async listCarriers(req, res) {
    try {
      const carriers = await User.findAllCarriers();

      return res.status(200).json(carriers);
    } catch (error) {
      console.error("List carriers error:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to load carriers",
      });
    }
  },

  /**
   * ============================================================
   * GET ALL REGISTERED CARRIERS
   *
   * Kept for compatibility with existing routes.
   * ============================================================
   */
  async getCarriers(req, res) {
    try {
      const carriers = await User.findAllCarriers();

      return res.status(200).json(carriers);
    } catch (error) {
      console.error("List carriers error:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to load carriers",
      });
    }
  },
};

module.exports = userController;
