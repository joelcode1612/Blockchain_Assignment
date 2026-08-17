// ─── Storage Keys ──────────────────────────────────────────
const STORAGE_WALLET = "traxenWallet";
const STORAGE_ROLE = "traxenUserRole";
const STORAGE_NAME = "traxenUserName";
const STORAGE_EMAIL = "traxenUserEmail";

// ─── Private Helpers ──────────────────────────────────────
function getWallet() {
  return localStorage.getItem(STORAGE_WALLET);
}
function getRole() {
  return localStorage.getItem(STORAGE_ROLE);
}
function getName() {
  return localStorage.getItem(STORAGE_NAME);
}
function getEmail() {
  return localStorage.getItem(STORAGE_EMAIL);
}

function setAuthData(wallet, role, name, email) {
  if (wallet) localStorage.setItem(STORAGE_WALLET, wallet);
  if (role) localStorage.setItem(STORAGE_ROLE, role);
  if (name) localStorage.setItem(STORAGE_NAME, name);
  if (email) localStorage.setItem(STORAGE_EMAIL, email);
}

function clearAuthData() {
  localStorage.removeItem(STORAGE_WALLET);
  localStorage.removeItem(STORAGE_ROLE);
  localStorage.removeItem(STORAGE_NAME);
  localStorage.removeItem(STORAGE_EMAIL);
  sessionStorage.clear();
}

// ─── Core Guard ────────────────────────────────────────────
function guard(allowedRoles) {
  const wallet = getWallet();
  const role = getRole();

  if (!wallet) {
    window.location.href = "/login";
    return false;
  }

  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!role || !allowedRoles.includes(role)) {
      window.location.href = "/login";
      return false;
    }
  }

  return true;
}

// ─── Auto‑Guard for Current Page ──────────────────────────
function autoGuard() {
  const path = window.location.pathname;

  let allowedRoles = [];
  if (path.includes("/shipper/") || path.includes("/shipper")) {
    allowedRoles = ["Shipper"];
  } else if (path.includes("/carrier/") || path.includes("/carrier")) {
    allowedRoles = ["Carrier"];
  } else {
    // Public pages – no role required
    return true;
  }

  return guard(allowedRoles);
}

// ─── For SPA Navigation ────────────────────────────────────
function requireRoleForUrl(url) {
  let allowedRoles = [];
  if (url.includes("/shipper/") || url.includes("/shipper")) {
    allowedRoles = ["Shipper"];
  } else if (url.includes("/carrier/") || url.includes("/carrier")) {
    allowedRoles = ["Carrier"];
  } else {
    return true;
  }
  return guard(allowedRoles);
}

// ─── Run the guard immediately on page load ──────────────
autoGuard();

// ─── Expose public functions ──────────────────────────────
window.Auth = {
  isAuthenticated: () => !!getWallet(),
  getCurrentRole: getRole,
  getName: getName,
  getWallet: getWallet,
  getEmail: getEmail,
  setAuthData: setAuthData,
  clearAuthData: clearAuthData,
  logout: function () {
    clearAuthData();
    window.location.href = "/";
  },
  requireRoleForUrl: requireRoleForUrl,
  autoGuard: autoGuard,
  guard: guard,
};

// ============================================================
// LOGIN / REGISTRATION UI (unchanged, but using central helpers)
// ============================================================

let selectedRole = null;

function togglePw(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === "password" ? "text" : "password";
}

function goRegStep(step) {
  [1, 2, 3].forEach((i) => {
    const el = document.getElementById("reg-step-" + i);
    if (el) el.classList.toggle("active", i === step);
  });
  document
    .querySelectorAll("#regDots .dot-bar")
    .forEach((dot, i) => dot.classList.toggle("on", i < step));
}

function selectRole(el) {
  document
    .querySelectorAll(".role-card")
    .forEach((card) => card.classList.remove("selected"));
  el.classList.add("selected");
  selectedRole = el.dataset.role;
  document.getElementById("regRoleContinue").disabled = false;
}

async function finishRegister() {
  try {
    const name = document.getElementById("regDisplayName").value.trim();
    const email = document.getElementById("regEmail").value.trim();

    if (!name) {
      alert("Please enter your display name.");
      return;
    }
    if (!email) {
      alert("Please enter your email.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (!selectedRole) {
      alert("Please select a role.");
      goRegStep(2);
      return;
    }

    console.log("Selected role:", selectedRole);
    const result = await registerBlockchainUser(selectedRole);
    const walletAddress = result.wallet;
    console.log("Registration result:", result);

    const dbResponse = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: walletAddress,
        role: selectedRole,
        displayName: name,
        email: email,
        signature: result.signature,
        message: result.message,
      }),
    });

    if (!dbResponse.ok) {
      const errorData = await dbResponse.json();
      throw new Error(errorData.message || "Failed to create account.");
    }

    const userData = await dbResponse.json();
    console.log("User created:", userData);

    // ─── Use central helper to store session ──────────────
    setAuthData(walletAddress, selectedRole, name, email);

    alert("Account created successfully as " + selectedRole + "!");
    window.location.href = "/" + selectedRole.toLowerCase();
  } catch (error) {
    console.error("Registration error:", error);
    alert(error.reason || error.message || "Registration failed.");
  }
}

function doLogin() {
  const address = localStorage.getItem("traxenWallet");
  if (!address) {
    alert("Please connect your wallet first.");
    return;
  }
  localStorage.setItem("traxenWallet", address);
  const role = localStorage.getItem("traxenUserRole") || "Shipper";
  window.location.href = "/" + role.toLowerCase();
}

function selectWallet(el, ctx) {
  el.parentElement
    .querySelectorAll(".wallet-opt")
    .forEach((w) => w.classList.remove("selected"));
  el.classList.add("selected");

  const status = document.getElementById(ctx + "WalletStatus");
  const walletName = el.querySelector(".wallet-name").textContent;
  status.className = "status-line connecting";
  status.innerHTML =
    '<div class="status-dot"></div><span>Connecting to ' +
    walletName +
    "…</span>";

  setTimeout(() => {
    status.className = "status-line connected";
    status.innerHTML = '<div class="status-dot"></div> ...';
    if (ctx === "reg") setTimeout(() => goRegStep(2), 500);
    if (ctx === "login") setTimeout(() => handleLogin(), 500);
  }, 900);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("reg-step-1")) goRegStep(1);
});

function handleLogout(event) {
  if (event) event.preventDefault();
  // ─── Use central helper ─────────────────────────────────
  clearAuthData();
  if (window.userWalletAddress) window.userWalletAddress = null;
  window.location.href = "/";
}

async function handleRegisterWalletConnection(element) {
  try {
    const address = await connectWallet();
    document
      .querySelectorAll(".wallet-opt")
      .forEach((wallet) => wallet.classList.remove("selected"));
    element.classList.add("selected");

    const status = document.getElementById("regWalletStatus");
    status.className = "status-line connected";
    status.innerHTML =
      '<div class="status-dot"></div>' +
      "<span>Connected · " +
      truncateAddress(address) +
      "</span>";

    const walletAddressEl = document.getElementById("regWalletAddr");
    if (walletAddressEl) walletAddressEl.textContent = address;

    setTimeout(() => goRegStep(2), 500);
  } catch (error) {
    console.error(error);
  }
}

function showAuthFeedback(message, type = "error") {
  const alertEl = document.getElementById("authAlert");
  if (!alertEl) return;
  alertEl.className = `auth-alert ${type}`;
  alertEl.innerHTML =
    type === "error"
      ? `<span>⚠️ ${message}</span>`
      : `<span>✓ ${message}</span>`;
}

async function handleLogin() {
  try {
    if (!window.ethereum) {
      showAuthFeedback(
        "MetaMask is not installed. Please install it.",
        "error",
      );
      return;
    }

    const loginResult = await blockchainLogin();

    if (loginResult.success && loginResult.authenticated) {
      showAuthFeedback("Login successful! Redirecting...", "success");

      // ─── Use central helper ─────────────────────────────
      setAuthData(
        loginResult.wallet,
        loginResult.role,
        loginResult.name || "User",
      );

      setTimeout(() => {
        window.location.href = "/" + loginResult.role.toLowerCase();
      }, 1200);
    } else {
      showAuthFeedback(
        "Wallet not recognized. Please register first.",
        "error",
      );
    }
  } catch (err) {
    showAuthFeedback(err.message || "Failed to authenticate.", "error");
  }
}
