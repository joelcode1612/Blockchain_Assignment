(function () {
  let userData = null;

  window.initCarrierProfile = async function () {
    try {
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      await loadProfile();

      // ═══ YON — REPUTATION MODULE ═══
      await loadReputation();
      // ═══ YON End ═══

      /// Fix - 2026-09-10 : load the real statistics + activity feed. These
      /// values used to be hardcoded demo numbers in carrier_profile.html.
      await Promise.all([loadStats(), loadActivity()]);
      /// Fix end

      // Update sidebar if the function exists
      if (typeof window.fillUserInfo === "function") {
        window.fillUserInfo();
      }
    } catch (error) {
      console.error("Failed to init profile:", error);
      showToast("Failed to load profile data", "error");
    }
  };

  async function loadProfile() {
    const walletAddress = localStorage.getItem("traxenWallet");
    if (!walletAddress) {
      showToast("Wallet not connected.", "warning");
      return;
    }

    try {
      const response = await fetch("/api/users/me", {
        headers: { "x-wallet-address": walletAddress },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch user data");
      }
      userData = await response.json();
      populateProfile(userData);
    } catch (error) {
      console.error("Load profile error:", error);
      showToast(error.message, "error");
    }
  }

  // ═══ YON — REPUTATION MODULE ═══
  async function loadReputation() {
    try {
      const wallet =
        localStorage.getItem("traxenWallet") || window.userWalletAddress;
      if (!wallet) return;

      const res = await fetch("/api/reputation/me", {
        headers: { "x-wallet-address": wallet },
      });
      if (!res.ok) return;

      const data = await res.json();
      const scoreEl = document.getElementById("reputationScore");
      const fillEl = document.getElementById("reputationFill");
      const noteEl = document.getElementById("reputationNote");

      const formatted = data.balanceFormatted || "0";
      const symbol = data.symbol || "REP";

      if (scoreEl) scoreEl.textContent = formatted + " " + symbol;
      if (fillEl) {
        const bal = parseFloat(formatted) || 0;
        /// Fix - 2026-09-10 : the REP token is capped at 120 on-chain
        /// (REPUTATION_CAP), so the progress bar must not use 500.
        const REPUTATION_CAP = 120;
        const pct = Math.min((bal / REPUTATION_CAP) * 100, 100);
        /// Fix end
        fillEl.style.width = pct + "%";
      }
      if (noteEl) {
        noteEl.textContent =
          "Earned " + formatted + " " + symbol + " from completed agreements";
      }
    } catch (e) {
      console.warn("[Yon] Failed to load reputation:", e.message);
    }
  }
  // ═══ YON End ═══

  /// Fix - 2026-09-10 : real carrier statistics computed from /api/agreements,
  /// replacing the hardcoded figures that previously shipped in the HTML.
  const ACTIVE_STATUSES = ["AwaitingFunding", "Active"];
  const CLOSED_STATUSES = [
    "Completed",
    "Rejected",
    "Cancelled",
    "Expired",
    "Refunded",
  ];

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
    const wallet = localStorage.getItem("traxenWallet");
    if (!wallet) return;

    try {
      const res = await fetch("/api/agreements", {
        headers: { "x-wallet-address": wallet },
      });
      if (!res.ok) return;

      const agreements = await res.json();
      if (!Array.isArray(agreements)) return;

      const target = wallet.toLowerCase();
      const mine = agreements.filter(
        (a) => (a.carrier_wallet || "").toLowerCase() === target,
      );

      const active = mine.filter((a) =>
        ACTIVE_STATUSES.includes(a.status),
      ).length;
      const completed = mine.filter((a) => a.status === "Completed").length;
      const closed = mine.filter((a) =>
        CLOSED_STATUSES.includes(a.status),
      ).length;

      const earnedEth = mine.reduce(
        (sum, a) => sum + weiToEth(a.released_amount),
        0,
      );

      let pendingVerification = 0;
      mine.forEach((a) => {
        if (!Array.isArray(a.milestones)) return;
        pendingVerification += a.milestones.filter(
          (m) => m.status === "Submitted",
        ).length;
      });

      setProfileText("statJobs", mine.length);
      setProfileText("statActiveCarrier", active);
      setProfileText("statCompletedCarrier", completed);
      setProfileText("statEarnedCarrier", earnedEth.toFixed(2));
      setProfileText("metricPending", pendingVerification);
      setProfileText(
        "metricCompletion",
        closed > 0 ? Math.round((completed / closed) * 100) + "%" : "0%",
      );
      // These two have no backing data source in the system yet, so the UI
      // shows an explicit "—" instead of a fabricated number.
      setProfileText("metricOnTime", "—");
      setProfileText("metricDisputes", "—");
    } catch (e) {
      console.warn("[Yon] Failed to load carrier statistics:", e.message);
    }
  }

  async function loadActivity() {
    const container = document.getElementById("carrierActivityList");
    if (!container) return;

    const wallet = localStorage.getItem("traxenWallet");
    if (!wallet) return;

    try {
      const res = await fetch("/api/history", {
        headers: { "x-wallet-address": wallet },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const data = await res.json();
      const events = Array.isArray(data.payments) ? data.payments : [];

      if (events.length === 0) {
        container.innerHTML =
          '<div style="padding:20px;text-align:center;color:var(--text-faint);">No recent activity</div>';
        return;
      }

      const icons = {
        Deposit: "↓",
        "Payment Release": "₿",
        Refund: "↩",
        "Reputation Reward": "+",
      };

      container.innerHTML = events
        .slice(0, 5)
        .map((ev) => {
          const icon = icons[ev.type] || "•";
          const when = ev.timestamp
            ? new Date(ev.timestamp).toLocaleDateString()
            : "";
          return `
            <div class="activity-row">
              <div class="activity-icon">${icon}</div>
              <div>
                <div class="activity-title">${ev.type || "Activity"}</div>
                <div class="activity-sub">${ev.description || ""}</div>
              </div>
              <div class="activity-time">${when}</div>
            </div>
          `;
        })
        .join("");
    } catch (e) {
      console.warn("[Yon] Failed to load carrier activity:", e.message);
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--text-faint);">Activity unavailable</div>';
    }
  }
  /// Fix end

  function populateProfile(data) {
    const displayName = data.display_name || "Carrier";
    const email = data.email || "";
    const role = data.role || "Carrier";
    const wallet =
      data.wallet_address || localStorage.getItem("traxenWallet") || "";

    // Profile card
    const nameEl = document.getElementById("profileName");
    if (nameEl) nameEl.textContent = displayName;

    const walletEl = document.getElementById("profileWallet");
    if (walletEl) walletEl.textContent = truncateAddress(wallet);

    // Main details
    const nameValue = document.getElementById("nameValue");
    if (nameValue) nameValue.textContent = displayName;

    const emailValue = document.getElementById("emailValue");
    if (emailValue) emailValue.textContent = email || "—";

    /// Fix - 2026-09-10 : fill the fields that were previously hardcoded in
    /// carrier_profile.html (role, member since, short wallet, status).
    const roleValue = document.getElementById("roleValue");
    if (roleValue) roleValue.textContent = role;

    const roleEl = document.getElementById("profileRole");
    if (roleEl) roleEl.textContent = role === "Carrier" ? "Verified Carrier" : role;

    const statusEl = document.getElementById("accountStatus");
    if (statusEl)
      statusEl.textContent = data.verification_status || "Active";

    const badgeEl = document.getElementById("statusBadgeCarrier");
    if (badgeEl)
      badgeEl.textContent = data.verification_status || "Verified";

    const walletShortEl = document.getElementById("walletShortValue");
    if (walletShortEl)
      walletShortEl.textContent = truncateAddress(wallet) || "—";

    const memberSinceEl = document.getElementById("memberSinceValue");
    if (memberSinceEl) {
      const joined = data.member_since || data.created_at;
      memberSinceEl.textContent = joined
        ? new Date(joined).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
          })
        : "—";
    }
    /// Fix end

    // Avatar initials
    const avatarEls = document.querySelectorAll(
      ".profile-avatar, .mini-avatar",
    );
    const initials = displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    avatarEls.forEach((el) => (el.textContent = initials || "U"));

    // Sidebar
    const miniName = document.querySelector(".mini-name");
    if (miniName) miniName.textContent = displayName;
    const miniRole = document.querySelector(".mini-role");
    if (miniRole) miniRole.textContent = role;

    // Edit form pre‑fill
    const nameInput = document.getElementById("nameInput");
    if (nameInput) nameInput.value = displayName;
    const emailInput = document.getElementById("emailInput");
    if (emailInput) emailInput.value = email || "";
  }

  window.toggleEdit = function () {
    const form = document.getElementById("editForm");
    if (!form) return;
    const isHidden = form.style.display === "none" || !form.style.display;
    form.style.display = isHidden ? "block" : "none";
    if (isHidden) {
      const nameInput = document.getElementById("nameInput");
      if (nameInput && userData) nameInput.value = userData.display_name || "";
      const emailInput = document.getElementById("emailInput");
      if (emailInput && userData) emailInput.value = userData.email || "";
    }
  };

  window.saveProfile = async function () {
    const nameInput = document.getElementById("nameInput");
    const emailInput = document.getElementById("emailInput");

    const displayName = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";

    if (!displayName) {
      showToast("Display name cannot be empty.", "warning");
      return;
    }

    const walletAddress = localStorage.getItem("traxenWallet");
    if (!walletAddress) {
      showToast("Wallet not connected.", "warning");
      return;
    }

    try {
      const response = await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletAddress,
        },
        body: JSON.stringify({ display_name: displayName, email: email }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update profile");
      }

      const updated = await response.json();
      localStorage.setItem("traxenUserName", displayName);
      userData = updated;
      populateProfile(updated);
      if (typeof window.fillUserInfo === "function") {
        window.fillUserInfo();
      }
      showToast("Profile updated successfully!", "success");
      const form = document.getElementById("editForm");
      if (form) form.style.display = "none";
    } catch (error) {
      console.error("Save profile error:", error);
      showToast(error.message, "error");
    }
  };

  window.copyWallet = function (address) {
    if (!address) {
      address = document.getElementById("profileWallet")?.textContent || "";
    }
    if (address.includes("…")) {
      address = localStorage.getItem("traxenWallet") || "";
    }
    if (!address) {
      showToast("No wallet address to copy.", "warning");
      return;
    }
    navigator.clipboard
      .writeText(address)
      .then(() => showToast("Wallet address copied!", "success"))
      .catch(() => {
        const textArea = document.createElement("textarea");
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        showToast("Wallet address copied!", "success");
      });
  };

  /// Fix - 2026-09-10 : the profile "Wallet" button used to call the
  /// placeholder alert('Wallet connection screen'). It now performs a real
  /// action against the connected wallet.
  window.handleWalletConnection = function () {
    const wallet = localStorage.getItem("traxenWallet");
    if (!wallet) {
      showToast("No wallet connected. Please connect MetaMask first.", "warning");
      return;
    }
    copyWallet(wallet);
  };
  /// Fix end

  function truncateAddress(address) {
    if (!address) return "";
    if (address.length <= 10) return address;
    return (
      address.substring(0, 6) + "…" + address.substring(address.length - 4)
    );
  }

  function showToast(message, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
      alert(message);
    }
  }

  // ─── Auto‑init ──────────────────────────────────────────
  if (document.getElementById("profileName")) {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      if (typeof window.initCarrierProfile === "function") {
        window.initCarrierProfile();
      }
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        if (typeof window.initCarrierProfile === "function") {
          window.initCarrierProfile();
        }
      });
    }
  }
})();
