// ─── PROFILE PAGE SCRIPT ──────────────────────────────

(function () {
  let profileData = null;

  async function fetchProfile() {
    const walletAddress = localStorage.getItem("traxenWallet");
    if (!walletAddress) throw new Error("No wallet connected");
    const res = await fetch("/api/users/me", {
      headers: { "x-wallet-address": walletAddress },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function renderProfile(data) {
    profileData = data;

    // Basic info
    const name = data.display_name || "Shipper";
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    document.getElementById("profileAvatar").textContent = initials;
    document.getElementById("profileName").textContent = name;
    document.getElementById("profileRole").textContent = data.role || "Shipper";
    document.getElementById("accountStatus").textContent =
      data.verification_status || "Active";

    // Wallet
    const wallet =
      data.wallet_address || localStorage.getItem("traxenWallet") || "0x...";
    document.getElementById("walletAddress").textContent = wallet;
    document.getElementById("walletShort").textContent =
      wallet.slice(0, 6) + "…" + wallet.slice(-4);

    // Reputation
    const rep = data.reputation_balance || 0;
    document.getElementById("reputationScore").textContent =
      rep.toFixed(1) + " / 5.0"; // assuming 5 max
    const fillPercent = Math.min((rep / 5) * 100, 100);
    document.getElementById("reputationFill").style.width = fillPercent + "%";
    document.getElementById("reputationNote").textContent =
      "Based on completed agreements and carrier feedback";

    // Account details
    document.getElementById("nameValue").textContent = name;
    document.getElementById("emailValue").textContent = data.email || "—";
    document.getElementById("roleValue").textContent = data.role || "Shipper";
    document.getElementById("memberSince").textContent =
      data.member_since || data.created_at || null
        ? new Date(data.member_since || data.created_at).toLocaleDateString()
        : "—";
    document.getElementById("statusBadge").textContent =
      data.verification_status || "Verified";

    // Edit form fields
    document.getElementById("nameInput").value = name;
    document.getElementById("emailInput").value = data.email || "";

    // Statistics
    const stats = data.statistics || {};
    document.getElementById("statTotal").textContent =
      stats.total_agreements || 0;
    document.getElementById("statActive").textContent =
      stats.active_agreements || 0;
    document.getElementById("statCompleted").textContent =
      stats.completed_agreements || 0;
    document.getElementById("statEscrow").textContent = (
      stats.total_escrow_eth || 0
    ).toFixed(2);

    // Performance
    document.getElementById("completionRate").textContent =
      (stats.completion_rate || 0) + "%";
    document.getElementById("onTimeRate").textContent =
      (stats.on_time_rate || 0) + "%";
    document.getElementById("disputesCount").textContent =
      stats.disputes_raised || 0;
    document.getElementById("pendingVerification").textContent =
      stats.pending_verification || 0;

    // Activity
    const activityContainer = document.getElementById("activityList");
    const activities = data.recent_activity || [];
    if (activities.length === 0) {
      activityContainer.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-faint);">No recent activity</div>`;
    } else {
      let html = "";
      activities.forEach((act) => {
        const icon = act.icon || "•";
        const time = act.time ? new Date(act.time).toLocaleDateString() : "";
        html += `
          <div class="activity-row">
            <div class="activity-icon">${icon}</div>
            <div>
              <div class="activity-title">${act.title}</div>
              <div class="activity-sub">${act.subtitle || ""}</div>
            </div>
            <div class="activity-time">${time}</div>
          </div>
        `;
      });
      activityContainer.innerHTML = html;
    }

    // Hide edit form
    document.getElementById("editForm").style.display = "none";
  }

  async function initProfile() {
    try {
      const data = await fetchProfile();
      renderProfile(data);
    } catch (error) {
      console.error("Profile load error:", error);
      const container = document.querySelector(".profile-layout");
      if (container) {
        container.innerHTML = `<div style="padding:40px;color:var(--red);">❌ Failed to load profile: ${error.message}</div>`;
      }
    }
  }

  // ─── GLOBAL FUNCTIONS (called from HTML) ──────────────
  window.toggleEdit = function () {
    const form = document.getElementById("editForm");
    form.style.display = form.style.display === "none" ? "block" : "none";
    // Pre-fill with current values
    document.getElementById("nameInput").value =
      document.getElementById("nameValue").textContent;
    document.getElementById("emailInput").value =
      document.getElementById("emailValue").textContent;
  };

  window.saveProfile = async function () {
    const name = document.getElementById("nameInput").value.trim();
    const email = document.getElementById("emailInput").value.trim();
    if (!name) {
      showToast("Name is required", "error");
      return;
    }
    try {
      const walletAddress = localStorage.getItem("traxenWallet");
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletAddress,
        },
        body: JSON.stringify({ display_name: name, email }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      const updated = await res.json();
      renderProfile(updated);
      document.getElementById("editForm").style.display = "none";
      showToast("Profile updated successfully", "success");
    } catch (error) {
      console.error("Save error:", error);
      showToast("Error saving profile", "error");
    }
  };

  window.copyWallet = function () {
    const wallet = document.getElementById("walletAddress").textContent;
    if (wallet && wallet !== "0x...") {
      navigator.clipboard
        .writeText(wallet)
        .then(() => {
          showToast("Wallet address copied", "success");
        })
        .catch(() => {
          alert("Copy: " + wallet);
        });
    }
  };

  window.handleWalletConnection = function () {
    alert("Wallet connection flow – implement as needed");
  };

  // ─── REGISTER INIT FUNCTION ──────────────────────────
  window.initProfile = initProfile;

  // Auto-init if page loaded directly (for testing)
  if (document.querySelector(".profile-layout")) {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      initProfile();
    } else {
      document.addEventListener("DOMContentLoaded", initProfile);
    }
  }
})();
