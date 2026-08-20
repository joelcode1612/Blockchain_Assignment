// ─── Storage Keys ──────────────────────────────────────────
const STORAGE_WALLET = "traxenWallet";
const STORAGE_ROLE = "traxenUserRole";
const STORAGE_NAME = "traxenUserName";
const STORAGE_EMAIL = "traxenUserEmail";

// ─── Private Helpers ──────────────────────────────────────
function getWallet() { return localStorage.getItem(STORAGE_WALLET); }
function getRole() { return localStorage.getItem(STORAGE_ROLE); }
function getName() { return localStorage.getItem(STORAGE_NAME); }
function getEmail() { return localStorage.getItem(STORAGE_EMAIL); }
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
  if (!wallet || !role) {
    window.location.href = "/login";
    return false;
  }
  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) {
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
  isAuthenticated: () => !!getWallet() && !!getRole(),
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
  requireRoleForUrl: function (url) {
    let allowedRoles = [];
    if (url.includes("/shipper/") || url.includes("/shipper")) allowedRoles = ["Shipper"];
    else if (url.includes("/carrier/") || url.includes("/carrier")) allowedRoles = ["Carrier"];
    else return true;
    return guard(allowedRoles);
  },
  autoGuard: autoGuard,
  guard: guard,

  // ─── NEW: ensure both auth data AND contract are valid ──
  ensureFullSession: function () {
    const wallet = this.getWallet();
    const role = this.getCurrentRole();

    if (!wallet || !role) {
      this.clearAuthData();
      window.location.href = "/login";
      return false;
    }

    // Check if contract is initialising – wait up to 5 seconds
    if (typeof window.isInitializing !== 'undefined' && window.isInitializing) {
      console.log("Contract initialising, waiting...");
      return new Promise((resolve) => {
        let attempts = 0;
        const check = setInterval(() => {
          attempts++;
          if (window.isConnected()) {
            clearInterval(check);
            resolve(true);
          } else if (attempts > 50) { // 5 seconds
            clearInterval(check);
            // Still not connected – try reconnect
            if (typeof window.reconnectWeb3 === 'function') {
              window.reconnectWeb3().then(connected => {
                if (!connected) {
                  this.clearAuthData();
                  window.location.href = "/login";
                }
                resolve(connected);
              });
            } else {
              this.clearAuthData();
              window.location.href = "/login";
              resolve(false);
            }
          }
        }, 100);
      });
    }

    // Normal check
    if (typeof window.isConnected === 'function' && !window.isConnected()) {
      if (typeof window.reconnectWeb3 === 'function') {
        return window.reconnectWeb3().then(connected => {
          if (!connected) {
            this.clearAuthData();
            window.location.href = "/login";
          }
          return connected;
        });
      } else {
        this.clearAuthData();
        window.location.href = "/login";
        return false;
      }
    }
    return true;
  }
};


// ============================================================
// LOGIN / REGISTRATION UI (using central helpers)
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
      showToast("Please enter your display name.", "warning");
      return;
    }
    if (!email) {
      showToast("Please enter your email.", "warning");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      showToast("Please enter a valid email address.", "warning");
      return;
    }
    if (!selectedRole) {
      showToast("Please select a role.", "warning");
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

    showToast(
      "Account created successfully as " + selectedRole + "!",
      "success",
    );
    setTimeout(() => {
      window.location.href = "/" + selectedRole.toLowerCase();
    }, 1500);
  } catch (error) {
    console.error("Registration error:", error);
    showToast(error.reason || error.message || "Registration failed.", "error");
  }
}

// ─── Check server availability on every page load ──────
async function checkServerAndSession() {
  const currentPath = window.location.pathname;
  const isPublicPage = ['/login', '/register', '/'].includes(currentPath) ||
    currentPath.startsWith('/login') ||
    currentPath.startsWith('/register');

  // Function to perform a single health check
  async function checkHealth() {
    try {
      const response = await fetch('/api/health', { method: 'GET' });
      if (!response.ok) {
        throw new Error('Server returned ' + response.status);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // Try twice with a 2‑second delay between attempts
  let healthy = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    healthy = await checkHealth();
    if (healthy) break;
    if (attempt < 2) {
      console.warn(`Health check attempt ${attempt} failed. Retrying in 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!healthy) {
    // Server is unreachable – clear the session
    console.warn('Server unreachable after 2 attempts – clearing session.');
    clearAuthData();

    // If we're on a protected page, redirect to login
    if (!isPublicPage) {
      window.location.href = '/login';
    } else {
      // If already on login/register, just show a warning (optional)
      if (typeof showToast === 'function') {
        showToast('Server is unreachable. Please try again later.', 'error');
      }
    }
  }
}


function doLogin() {
  const address = localStorage.getItem("traxenWallet");
  if (!address) {
    showToast("Please connect your wallet first.", "warning");
    // Redirect to login page (if not already there)
    if (window.location.pathname !== "/login") {
      // Use replace to avoid history issues
      setTimeout(() => {
        window.location.replace("/login");
      }, 1500); // keep the toast visible
    }
    return;
  }
  // Proceed with login
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
  // Reset blockchain state
  if (typeof window.resetWalletState === "function") {
    window.resetWalletState();
  }
  clearAuthData();
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
    showToast("Failed to connect wallet: " + error.message, "error");
  }
}

async function handleLogin() {
  try {
    const loginResult = await blockchainLogin();
    if (loginResult.success && loginResult.authenticated) {
      showToast("Login successful! Redirecting...", "success");

      // Fetch user details from database
      let displayName = "User";
      let email = "";
      try {
        const meResponse = await fetch("/api/users/me", {
          headers: { "x-wallet-address": loginResult.wallet },
        });
        if (meResponse.ok) {
          const userData = await meResponse.json();
          displayName = userData.display_name || displayName;
          email = userData.email || "";
        }
      } catch (e) {
        console.warn("Could not fetch user details", e);
      }

      setAuthData(loginResult.wallet, loginResult.role, displayName, email);
      setTimeout(() => {
        window.location.href = "/" + loginResult.role.toLowerCase();
      }, 1200);
    } else {
      showToast("Wallet not recognized. Please register first.", "error");
    }
  } catch (err) {
    showToast(err.message || "Failed to authenticate.", "error");
  }
}

// Run the check as soon as the DOM is ready.
document.addEventListener('DOMContentLoaded', checkServerAndSession);