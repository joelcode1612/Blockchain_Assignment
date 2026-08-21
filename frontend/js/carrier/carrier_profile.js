(function () {
  let userData = null;

  window.initCarrierProfile = async function () {
    try {
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      await loadProfile();

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
