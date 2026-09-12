// ─── PROFILE PAGE SCRIPT ──────────────────────────────

(function () {
  let profileData = null;

  // ─── BEARER AUTH HELPER (replaces legacy x-wallet-address) ───
  function authHeaders(extra = {}) {
    if (typeof window.getAuthHeaders === "function") {
      return window.getAuthHeaders(extra);
    }
    const token =
      window.Auth?.getToken?.() ||
      window.Session?.getToken?.() ||
      localStorage.getItem("traxenToken") ||
      sessionStorage.getItem("traxenToken");

    const headers = { ...extra };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  function hasToken() {
    return !!(
      window.Auth?.getToken?.() ||
      window.Session?.getToken?.() ||
      localStorage.getItem("traxenToken") ||
      sessionStorage.getItem("traxenToken")
    );
  }

  // ─── FETCH PROFILE ────────────────────────────────────
  async function fetchProfile() {
    const res = await fetch("/api/users/me", {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ─── RENDER PROFILE ───────────────────────────────────
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

    // Wallet — prefer the server-provided value, fall back to session,
    // then to the legacy local key only for display purposes.
    const sessionWallet =
      window.Session?.getSession?.()?.wallet ||
      window.Session?.getSession?.()?.wallet_address ||
      null;

    const wallet =
      data.wallet_address ||
      sessionWallet ||
      localStorage.getItem("traxenWallet") ||
      "0x...";

    document.getElementById("walletAddress").textContent = wallet;
    document.getElementById("walletShort").textContent =
      wallet.slice(0, 6) + "…" + wallet.slice(-4);

    /// Fix : reputation is a capped REP token balance (100 minted
    /// on carrier registration, hard cap 120), not a 0–5 star rating.
    /// loadReputation() replaces this database mirror with the on-chain value.
    applyReputation(Number(data.reputation_balance || 0));
    /// Fix end

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

    // Statistics (initial placeholders — loadStats() overwrites these)
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

  /// Fix : the profile page used to render "0.0 / 5.0" reputation
  /// and all-zero statistics, because /api/users/me does not return a
  /// statistics object. Reputation now follows the REP token model and the
  /// numbers are computed from the real agreements endpoint.
  const REPUTATION_CAP = 120;
  const ACTIVE_STATUSES = ["AwaitingFunding", "Active"];
  const CLOSED_STATUSES = [
    "Completed",
    "Rejected",
    "Cancelled",
    "Expired",
    "Refunded",
  ];
  const UNFUNDED_STATUSES = ["PendingAcceptance", "Rejected", "Cancelled"];

  function applyReputation(balance) {
    const scoreEl = document.getElementById("reputationScore");
    if (scoreEl) scoreEl.textContent = balance + " REP";

    const fillEl = document.getElementById("reputationFill");
    if (fillEl) {
      fillEl.style.width =
        Math.min((balance / REPUTATION_CAP) * 100, 100) + "%";
    }

    const noteEl = document.getElementById("reputationNote");
    if (noteEl) {
      noteEl.textContent =
        "REP tokens earned from completed agreements (max " +
        REPUTATION_CAP +
        ")";
    }
  }

  async function loadReputation() {
    if (!hasToken()) return;

    try {
      const res = await fetch("/api/reputation/me", {
        method: "GET",
        headers: authHeaders(),
      });
      if (!res.ok) return;

      const data = await res.json();
      applyReputation(parseFloat(data.balanceFormatted || "0") || 0);
    } catch (e) {
      console.warn("[Yon] Failed to load reputation:", e.message);
    }
  }

  function weiToEth(value) {
    try {
      if (window.ethers && typeof window.ethers.formatEther === "function") {
        return parseFloat(window.ethers.formatEther(String(value || 0)));
      }
    } catch (e) {
      /* fall through to the manual conversion below */
    }
    const n = Number(value || 0);
    return isNaN(n) ? 0 : n / 1e18;
  }

  function setProfileText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function loadStats() {
    if (!hasToken()) return;

    try {
      const res = await fetch("/api/agreements", {
        method: "GET",
        headers: authHeaders(),
      });
      if (!res.ok) return;

      const agreements = await res.json();
      if (!Array.isArray(agreements)) return;

      // Identify this shipper from the session (server already scoped the
      // response to the authed user, but we still filter by wallet for the
      // "mine" view in case the endpoint returns a superset).
      const sessionWallet =
        window.Session?.getSession?.()?.wallet ||
        window.Session?.getSession?.()?.wallet_address ||
        profileData?.wallet_address ||
        "";
      const target = sessionWallet.toLowerCase();

      const mine = target
        ? agreements.filter(
            (a) => (a.shipper_wallet || "").toLowerCase() === target,
          )
        : agreements;

      const active = mine.filter((a) =>
        ACTIVE_STATUSES.includes(a.status),
      ).length;
      const completed = mine.filter((a) => a.status === "Completed").length;
      const closed = mine.filter((a) =>
        CLOSED_STATUSES.includes(a.status),
      ).length;

      // Escrow committed = everything that was actually funded.
      const escrowEth = mine.reduce((sum, a) => {
        if (UNFUNDED_STATUSES.includes(a.status)) return sum;
        return sum + weiToEth(a.escrow_amount);
      }, 0);

      let pendingVerification = 0;
      mine.forEach((a) => {
        if (!Array.isArray(a.milestones)) return;
        pendingVerification += a.milestones.filter(
          (m) => m.status === "Submitted",
        ).length;
      });

      setProfileText("statTotal", mine.length);
      setProfileText("statActive", active);
      setProfileText("statCompleted", completed);
      setProfileText("statEscrow", escrowEth.toFixed(2));
      setProfileText(
        "completionRate",
        closed > 0 ? Math.round((completed / closed) * 100) + "%" : "0%",
      );
      setProfileText("pendingVerification", pendingVerification);
      // These two have no backing data source in the system yet, so the UI
      // shows an explicit "—" instead of a fabricated number.
      setProfileText("onTimeRate", "—");
      setProfileText("disputesCount", "—");
    } catch (e) {
      console.warn("[Yon] Failed to load shipper statistics:", e.message);
    }
  }
  /// Fix end

  async function initProfile() {
    try {
      const data = await fetchProfile();
      renderProfile(data);

      /// Fix : hydrate reputation + statistics from real sources.
      await Promise.all([loadReputation(), loadStats()]);
      /// Fix end
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
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
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
