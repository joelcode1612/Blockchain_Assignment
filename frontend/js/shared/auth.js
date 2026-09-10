// ============================================================
// TRAXEN AUTHENTICATION + SESSION MANAGEMENT
// ============================================================

// ─── Storage Keys ──────────────────────────────────────────
const STORAGE_WALLET = "traxenWallet";
const STORAGE_ROLE = "traxenUserRole";
const STORAGE_NAME = "traxenUserName";
const STORAGE_EMAIL = "traxenUserEmail";
const STORAGE_TOKEN = "traxenAuthToken";

// ============================================================
// PRIVATE HELPERS
// ============================================================

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

function getToken() {
  return localStorage.getItem(STORAGE_TOKEN);
}

// ============================================================
// STORE AUTHENTICATED USER DATA
// ============================================================

function setAuthData(wallet, role, name, email) {
  if (wallet) {
    localStorage.setItem(STORAGE_WALLET, wallet);
  }

  if (role) {
    localStorage.setItem(STORAGE_ROLE, role);
  }

  if (name) {
    localStorage.setItem(STORAGE_NAME, name);
  }

  if (email !== undefined && email !== null) {
    localStorage.setItem(STORAGE_EMAIL, email);
  }
}

// ============================================================
// CLEAR ALL AUTHENTICATION DATA
// ============================================================

function clearAuthData() {
  localStorage.removeItem(STORAGE_WALLET);
  localStorage.removeItem(STORAGE_ROLE);
  localStorage.removeItem(STORAGE_NAME);
  localStorage.removeItem(STORAGE_EMAIL);
  localStorage.removeItem(STORAGE_TOKEN);

  sessionStorage.clear();
}

// ============================================================
// CHECK WHETHER CURRENT PAGE IS PUBLIC
// ============================================================

function isPublicPage() {
  const path = window.location.pathname;

  return (
    path === "/" || path === "/connect.html" || path.startsWith("/connect")
  );
}

// ============================================================
// ROLE GUARD
// ============================================================

function guard(allowedRoles) {
  const wallet = getWallet();
  const role = getRole();
  const token = getToken();

  // Authentication information must exist.
  if (!wallet || !role || !token) {
    showToast("Please sign in to access this page.", "error");

    setTimeout(() => {
      window.location.href = "/connect.html";
    }, 1500);

    return false;
  }

  // Verify role authorization for this page.
  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) {
      showToast(
        "Access denied: You do not have permission to view this page.",
        "error",
      );

      setTimeout(() => {
        window.location.href = "/connect.html";
      }, 1500);

      return false;
    }
  }

  return true;
}

// ============================================================
// AUTO-GUARD CURRENT PAGE
// ============================================================

function autoGuard() {
  const path = window.location.pathname;

  let allowedRoles = [];

  if (path.includes("/shipper/") || path.includes("/shipper")) {
    allowedRoles = ["Shipper"];
  } else if (path.includes("/carrier/") || path.includes("/carrier")) {
    allowedRoles = ["Carrier"];
  } else {
    // Public page.
    return true;
  }

  return guard(allowedRoles);
}

// ============================================================
// SPA / URL ROLE GUARD
// ============================================================

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

// ============================================================
// RUN LOCAL GUARD IMMEDIATELY
// ============================================================

autoGuard();

// ============================================================
// PUBLIC AUTH OBJECT
// ============================================================

window.Auth = {
  // ----------------------------------------------------------
  // BASIC AUTH STATE
  // ----------------------------------------------------------

  isAuthenticated: () => !!getToken() && !!getWallet() && !!getRole(),

  getToken: getToken,

  getCurrentRole: getRole,

  getName: getName,

  getWallet: getWallet,

  getEmail: getEmail,

  setAuthData: setAuthData,

  clearAuthData: clearAuthData,

  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  logout: function () {
    clearAuthData();

    if (typeof window.resetWalletState === "function") {
      try {
        window.resetWalletState();
      } catch (error) {
        console.warn("Could not reset Web3 wallet state:", error);
      }
    }

    window.location.href = "/";
  },

  // ----------------------------------------------------------
  // ROLE PROTECTION
  // ----------------------------------------------------------

  requireRoleForUrl: function (url) {
    let allowedRoles = [];

    if (url.includes("/shipper/") || url.includes("/shipper")) {
      allowedRoles = ["Shipper"];
    } else if (url.includes("/carrier/") || url.includes("/carrier")) {
      allowedRoles = ["Carrier"];
    } else {
      return true;
    }

    return guard(allowedRoles);
  },

  autoGuard: autoGuard,

  guard: guard,

  // ==========================================================
  // COMPLETE SESSION VALIDATION
  // ==========================================================
  //
  // This checks:
  //
  // 1. JWT exists
  // 2. Wallet exists
  // 3. Role exists
  // 4. MetaMask exists
  // 5. Current MetaMask account matches authenticated wallet
  // 6. Backend accepts JWT
  // 7. Backend wallet matches wallet
  // 8. Backend role matches role
  // 9. Web3 provider/signer/contract are ready
  //
  // ==========================================================

  ensureFullSession: async function () {
    const redirectToConnect = () => {
      this.clearAuthData();

      if (typeof window.resetWalletState === "function") {
        try {
          window.resetWalletState();
        } catch (error) {
          console.warn("Could not reset Web3 wallet state:", error);
        }
      }

      window.location.href = "/connect.html";

      return false;
    };

    try {
      // ======================================================
      // 1. GET STORED SESSION DATA
      // ======================================================

      const wallet = this.getWallet();
      const role = this.getCurrentRole();
      const token = this.getToken();

      console.log("🔐 Checking Traxen session...");

      // JWT is REQUIRED.
      if (!token || !wallet || !role) {
        console.warn("❌ Authentication session data missing.");

        return redirectToConnect();
      }

      // ======================================================
      // 2. CHECK METAMASK
      // ======================================================

      if (!window.ethereum) {
        console.warn("❌ MetaMask is not available.");

        return redirectToConnect();
      }

      // ======================================================
      // 3. GET CURRENT METAMASK ACCOUNT
      // ======================================================

      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (!accounts || accounts.length === 0) {
        console.warn("❌ No MetaMask account is connected.");

        return redirectToConnect();
      }

      const currentWallet = accounts[0].toLowerCase();

      const authenticatedWallet = wallet.toLowerCase();

      console.log("🔐 Stored wallet:", authenticatedWallet);

      console.log("🔐 Current MetaMask wallet:", currentWallet);

      // ======================================================
      // 4. DETECT ACCOUNT SWITCHING
      // ======================================================

      if (currentWallet !== authenticatedWallet) {
        console.warn(
          "❌ MetaMask account does not match authenticated wallet.",
        );

        return redirectToConnect();
      }

      console.log("✅ MetaMask account matches authenticated wallet.");

      // ======================================================
      // 5. VERIFY JWT WITH BACKEND
      // ======================================================

      const meResponse = await fetch("/api/users/me", {
        method: "GET",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!meResponse.ok) {
        console.warn(
          "❌ Backend rejected authentication token:",
          meResponse.status,
        );

        return redirectToConnect();
      }

      const userData = await meResponse.json();

      // ======================================================
      // 6. VERIFY BACKEND WALLET
      // ======================================================

      if (
        !userData.wallet_address ||
        userData.wallet_address.toLowerCase() !== authenticatedWallet
      ) {
        console.warn("❌ Backend wallet does not match authenticated wallet.");

        return redirectToConnect();
      }

      // ======================================================
      // 7. VERIFY BACKEND ROLE
      // ======================================================

      if (userData.role !== role) {
        console.warn("❌ Stored role does not match backend role.");

        return redirectToConnect();
      }

      console.log("✅ JWT authentication verified.");

      console.log("✅ Backend user verified.");

      console.log("✅ Role verified:", userData.role);

      // ======================================================
      // 8. ENSURE WEB3 + CONTRACT ARE READY
      // ======================================================

      if (typeof window.ensureWeb3Ready === "function") {
        try {
          const web3 = await window.ensureWeb3Ready();

          if (!web3 || !web3.contract) {
            throw new Error("Contract instance unavailable.");
          }

          console.log("✅ Web3 is ready.");

          console.log("✅ Contract is ready.");
        } catch (web3Error) {
          console.error("❌ Web3/contract initialization failed:", web3Error);

          return redirectToConnect();
        }
      } else {
        // ----------------------------------------------------
        // FALLBACK FOR OLD WEB3 IMPLEMENTATIONS
        // ----------------------------------------------------

        if (typeof window.isConnected === "function" && !window.isConnected()) {
          if (typeof window.reconnectWeb3 === "function") {
            const connected = await window.reconnectWeb3();

            if (!connected) {
              console.warn("❌ Web3 reconnect failed.");

              return redirectToConnect();
            }

            console.log("✅ Web3 connection restored.");
          } else {
            console.warn("❌ Web3 unavailable and reconnectWeb3() is missing.");

            return redirectToConnect();
          }
        }
      }

      // ======================================================
      // 9. FULL SESSION VALID
      // ======================================================

      console.log("✅ Full Traxen session verified.");

      return true;
    } catch (error) {
      console.error("❌ Session verification failed:", error);

      return redirectToConnect();
    }
  },
};

// ============================================================
// LOGIN / REGISTRATION UI
// ============================================================

let selectedRole = null;

// ============================================================
// PASSWORD TOGGLE
// ============================================================

function togglePw(id) {
  const el = document.getElementById(id);

  if (el) {
    el.type = el.type === "password" ? "text" : "password";
  }
}

// ============================================================
// REGISTRATION STEP CONTROL
// ============================================================

function goRegStep(step) {
  [1, 2, 3].forEach((i) => {
    const el = document.getElementById("reg-step-" + i);

    if (el) {
      el.classList.toggle("active", i === step);
    }
  });

  document.querySelectorAll("#regDots .dot-bar").forEach((dot, i) => {
    dot.classList.toggle("on", i < step);
  });
}

// ============================================================
// ROLE SELECTION
// ============================================================

function selectRole(el) {
  document.querySelectorAll(".role-card").forEach((card) => {
    card.classList.remove("selected");
  });

  el.classList.add("selected");

  selectedRole = el.dataset.role;

  const continueButton = document.getElementById("regRoleContinue");

  if (continueButton) {
    continueButton.disabled = false;
  }
}

// ============================================================
// REGISTRATION
// ============================================================

async function finishRegister() {
  try {
    // ======================================================
    // 1. FORM DATA
    // ======================================================

    const name = document.getElementById("regDisplayName").value.trim();

    const email = document.getElementById("regEmail").value.trim();

    let walletAddress = document
      .getElementById("regWalletAddr")
      .textContent.trim();

    // ======================================================
    // 2. VALIDATE FORM
    // ======================================================

    if (!name) {
      return showToast("Please enter your display name.", "warning");
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showToast("Please enter a valid email.", "warning");
    }

    if (!selectedRole) {
      showToast("Please select a role.", "warning");

      return goRegStep(2);
    }

    // ======================================================
    // 3. METAMASK
    // ======================================================

    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    // ======================================================
    // 4. BLOCKCHAIN REGISTRATION
    // ======================================================

    try {
      const result = await registerBlockchainUser(selectedRole);

      if (result && result.wallet) {
        walletAddress = result.wallet;
      }

      console.log("✅ Blockchain registration successful:", result);
    } catch (chainError) {
      // Existing blockchain user is allowed
      // to continue with backend authentication.

      if (
        chainError.message &&
        chainError.message.includes("already registered")
      ) {
        console.warn("⚠️ Wallet already registered on blockchain.");

        console.warn("Proceeding with backend authentication...");
      } else {
        throw chainError;
      }
    }

    // ======================================================
    // 5. REQUEST SERVER-GENERATED NONCE
    // ======================================================

    const nonceResponse = await fetch(`/api/auth/nonce/${walletAddress}`);

    const nonceData = await nonceResponse.json();

    if (!nonceResponse.ok || !nonceData.success || !nonceData.nonce) {
      throw new Error(
        nonceData.message || "Failed to generate authentication nonce.",
      );
    }

    const nonce = nonceData.nonce;

    console.log("🔐 Registration nonce received:", nonce);

    // ======================================================
    // 6. CREATE HUMAN-READABLE SIGNATURE MESSAGE
    // ======================================================

    const messageToSign =
      `Traxen Account Registration\n\n` +
      `Please sign this message to verify that you control this wallet.\n\n` +
      `This signature does not send a transaction and does not cost gas.\n\n` +
      `Nonce: ${nonce}`;

    // ======================================================
    // 7. REQUEST METAMASK SIGNATURE
    // ======================================================

    const provider = new ethers.BrowserProvider(window.ethereum);

    const signer = await provider.getSigner();

    const signerAddress = await signer.getAddress();

    // Make sure MetaMask account
    // matches the registration wallet.

    if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error(
        "The selected MetaMask account does not match the registration wallet.",
      );
    }

    console.log("✍️ Requesting MetaMask signature...");

    const signature = await signer.signMessage(messageToSign);

    console.log("✅ MetaMask signature created");

    // ======================================================
    // 8. SEND REGISTRATION TO BACKEND
    // ======================================================

    const dbResponse = await fetch("/api/auth/register", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        walletAddress: walletAddress,

        role: selectedRole,

        displayName: name,

        email: email,

        signature: signature,

        message: messageToSign,
      }),
    });

    const registerData = await dbResponse.json();

    // ======================================================
    // 9. BACKEND AUTHENTICATION RESULT
    // ======================================================

    if (!dbResponse.ok || !registerData.success) {
      throw new Error(
        registerData.message || "Registration authentication failed.",
      );
    }

    // ======================================================
    // 10. BACKEND MUST RETURN JWT
    // ======================================================

    if (!registerData.token) {
      throw new Error(
        "Registration succeeded but the authentication token was not returned.",
      );
    }

    // ======================================================
    // 11. STORE JWT
    // ======================================================

    localStorage.setItem(STORAGE_TOKEN, registerData.token);

    console.log("✅ Registration JWT stored");

    // ======================================================
    // 12. STORE USER INFORMATION
    // ======================================================

    setAuthData(
      registerData.user?.wallet_address || walletAddress,

      registerData.user?.role || selectedRole,

      registerData.user?.display_name || name,

      registerData.user?.email || email,
    );

    console.log("✅ Registration authentication completed");

    // ======================================================
    // 13. SUCCESS MESSAGE
    // ======================================================

    showToast(
      "Account created successfully as " + selectedRole + "!",
      "success",
    );

    // ======================================================
    // 14. REDIRECT
    // ======================================================

    setTimeout(() => {
      window.location.href =
        "/" + selectedRole.toLowerCase() + "_dashboard.html";
    }, 1500);
  } catch (error) {
    console.error("❌ Registration error:", error);

    showToast(error.message || "Registration failed.", "error");
  }
}

// ============================================================
// SERVER HEALTH CHECK
// ============================================================

async function checkServerAndSession() {
  const currentPath = window.location.pathname;

  const publicPage = isPublicPage();

  // ----------------------------------------------------------
  // HEALTH CHECK FUNCTION
  // ----------------------------------------------------------

  async function checkHealth() {
    try {
      const response = await fetch("/api/health", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Server returned " + response.status);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // ----------------------------------------------------------
  // TRY HEALTH CHECK TWICE
  // ----------------------------------------------------------

  let healthy = false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    healthy = await checkHealth();

    if (healthy) {
      break;
    }

    if (attempt < 2) {
      console.warn(`Health check attempt ${attempt} failed. Retrying in 2s...`);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // ----------------------------------------------------------
  // SERVER NOT AVAILABLE
  // ----------------------------------------------------------

  if (!healthy) {
    console.warn("Server unreachable after 2 attempts – clearing session.");

    clearAuthData();

    if (!publicPage) {
      window.location.href = "/connect.html";
    } else {
      if (typeof showToast === "function") {
        showToast("Server is unreachable. Please try again later.", "error");
      }
    }

    return false;
  }

  // ----------------------------------------------------------
  // FULL SESSION VALIDATION
  // ----------------------------------------------------------
  //
  // Only protected pages need this.
  //
  // connect.html is intentionally excluded.
  //

  if (!publicPage) {
    if (window.Auth && typeof window.Auth.ensureFullSession === "function") {
      return await window.Auth.ensureFullSession();
    }
  }

  return true;
}

// ============================================================
// LOGIN BUTTON COMPATIBILITY FUNCTION
// ============================================================

function doLogin() {
  handleLogin();
}

// ============================================================
// WALLET SELECTION UI
// ============================================================

function selectWallet(el, ctx) {
  if (el.classList.contains("disabled")) {
    return;
  }

  el.style.opacity = "0.6";

  el.style.pointerEvents = "none";

  el.parentElement.querySelectorAll(".wallet-opt").forEach((w) => {
    w.classList.remove("selected");
  });

  el.classList.add("selected");

  const status = document.getElementById(ctx + "WalletStatus");

  const walletName = el.querySelector(".wallet-name")?.textContent || "wallet";

  if (status) {
    status.className = "status-line connecting";

    status.innerHTML =
      '<div class="status-dot"></div>' +
      "<span>Connecting to " +
      walletName +
      "…</span>";
  }

  setTimeout(() => {
    if (status) {
      status.className = "status-line connected";

      status.innerHTML =
        '<div class="status-dot"></div>' + "<span>Connected</span>";
    }

    if (ctx === "reg") {
      setTimeout(() => goRegStep(2), 500);
    }

    if (ctx === "login") {
      setTimeout(() => handleLogin(), 500);
    }
  }, 900);

  el.style.opacity = "1";

  el.style.pointerEvents = "auto";
}

// ============================================================
// DOM READY
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("reg-step-1")) {
    goRegStep(1);
  }
});

// ============================================================
// LOGOUT
// ============================================================

function handleLogout(event) {
  if (event) {
    event.preventDefault();
  }

  // Reset blockchain state first.

  if (typeof window.resetWalletState === "function") {
    try {
      window.resetWalletState();
    } catch (error) {
      console.warn("Could not reset Web3 wallet state:", error);
    }
  }

  // Remove authentication data.

  clearAuthData();

  // Redirect.

  window.location.href = "/";
}

// ============================================================
// REGISTRATION WALLET CONNECTION
// ============================================================

async function handleRegisterWalletConnection(element) {
  try {
    // --------------------------------------------------------
    // 1. CONNECT METAMASK
    // --------------------------------------------------------

    const address = await connectWallet();

    document.querySelectorAll(".wallet-opt").forEach((wallet) => {
      wallet.classList.remove("selected");
    });

    element.classList.add("selected");

    // --------------------------------------------------------
    // 2. DISPLAY WALLET
    // --------------------------------------------------------

    const walletAddressEl = document.getElementById("regWalletAddr");

    if (walletAddressEl) {
      walletAddressEl.textContent = address;
    }

    // --------------------------------------------------------
    // 3. CHECK WHETHER BLOCKCHAIN USER EXISTS
    // --------------------------------------------------------

    const isRegistered = await checkUserRegistered(address);

    if (isRegistered) {
      // Returning user.

      showToast("Account recognized. Logging you in...", "info");

      setTimeout(() => handleLogin(), 1000);
    } else {
      // New user.

      setTimeout(() => goRegStep(2), 500);
    }
  } catch (error) {
    console.error("Wallet Connection Error:", error);

    showToast(
      "Unable to connect wallet. Please open MetaMask and try again.",
      "error",
    );
  }
}

// ============================================================
// LOGIN
// ============================================================

async function handleLogin() {
  try {
    // ======================================================
    // 1. CHECK METAMASK
    // ======================================================

    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    // ======================================================
    // 2. GET CURRENT METAMASK ACCOUNT
    // ======================================================

    const provider = new ethers.BrowserProvider(window.ethereum);

    const signer = await provider.getSigner();

    const walletAddress = await signer.getAddress();

    console.log("🔐 Login wallet:", walletAddress);

    showToast("Verifying your wallet...", "info");

    // ======================================================
    // 3. REQUEST FRESH SERVER NONCE
    // ======================================================

    const nonceResponse = await fetch(`/api/auth/nonce/${walletAddress}`);

    const nonceData = await nonceResponse.json();

    if (!nonceResponse.ok || !nonceData.success || !nonceData.nonce) {
      throw new Error(
        nonceData.message || "Failed to request authentication nonce.",
      );
    }

    const nonce = nonceData.nonce;

    console.log("🔐 Login nonce received:", nonce);

    // ======================================================
    // 4. CREATE HUMAN-READABLE LOGIN MESSAGE
    // ======================================================

    const messageToSign =
      `Traxen Login Verification\n\n` +
      `Please sign this message to verify that you control this wallet.\n\n` +
      `This signature does not send a transaction and does not cost gas.\n\n` +
      `Nonce: ${nonce}`;

    // ======================================================
    // 5. REQUEST METAMASK SIGNATURE
    // ======================================================

    console.log("✍️ Requesting MetaMask signature...");

    const signature = await signer.signMessage(messageToSign);

    console.log("✍️ Login signature created");

    // ======================================================
    // 6. SEND LOGIN REQUEST TO BACKEND
    // ======================================================

    const loginResponse = await fetch("/api/auth/login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        walletAddress: walletAddress,

        signature: signature,

        message: messageToSign,
      }),
    });

    const loginData = await loginResponse.json();

    // ======================================================
    // 7. BACKEND AUTHENTICATION RESULT
    // ======================================================

    if (!loginResponse.ok || !loginData.success) {
      throw new Error(loginData.message || "Login authentication failed.");
    }

    // ======================================================
    // 8. JWT MUST BE RETURNED
    // ======================================================

    if (!loginData.token) {
      throw new Error("Authentication succeeded but no JWT was returned.");
    }

    // ======================================================
    // 9. STORE JWT
    // ======================================================

    localStorage.setItem(STORAGE_TOKEN, loginData.token);

    console.log("✅ JWT stored");

    // ======================================================
    // 10. STORE USER INFORMATION
    // ======================================================

    if (!loginData.user) {
      throw new Error(
        "Authentication succeeded but user information was not returned.",
      );
    }

    setAuthData(
      loginData.user.wallet_address,

      loginData.user.role,

      loginData.user.display_name,

      loginData.user.email || "",
    );

    // ======================================================
    // 11. FINAL AUTHENTICATION LOGS
    // ======================================================

    console.log("✅ Login authenticated");

    console.log("✅ Authenticated wallet:", loginData.user.wallet_address);

    console.log("✅ Authenticated role:", loginData.user.role);

    // ======================================================
    // 12. SUCCESS MESSAGE
    // ======================================================

    showToast("Welcome back! Loading your dashboard...", "success");

    // ======================================================
    // 13. REDIRECT BASED ON BACKEND ROLE
    // ======================================================

    setTimeout(() => {
      window.location.href =
        "/" + loginData.user.role.toLowerCase() + "_dashboard.html";
    }, 1200);
  } catch (error) {
    console.error("❌ Login Error:", error);

    showToast(error.message || "Unable to complete login.", "error");
  }
}

// ============================================================
// PAGE LOAD SESSION CHECK
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await checkServerAndSession();
  } catch (error) {
    console.error("❌ Startup session check failed:", error);
  }
});

// ============================================================
// METAMASK ACCOUNT CHANGE
// ============================================================

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    console.warn("⚠️ MetaMask account changed:", accounts);

    // No account connected.

    if (!accounts || accounts.length === 0) {
      clearAuthData();

      if (typeof window.resetWalletState === "function") {
        try {
          window.resetWalletState();
        } catch (error) {
          console.warn("Could not reset Web3 state:", error);
        }
      }

      window.location.href = "/connect.html";

      return;
    }

    const currentAccount = accounts[0].toLowerCase();

    const authenticatedWallet = getWallet();

    if (
      authenticatedWallet &&
      currentAccount !== authenticatedWallet.toLowerCase()
    ) {
      console.warn("❌ MetaMask account changed to a different wallet.");

      clearAuthData();

      if (typeof window.resetWalletState === "function") {
        try {
          window.resetWalletState();
        } catch (error) {
          console.warn("Could not reset Web3 state:", error);
        }
      }

      window.location.href = "/connect.html";
    }
  });

  // ==========================================================
  // METAMASK NETWORK / CHAIN CHANGE
  // ==========================================================

  window.ethereum.on("chainChanged", () => {
    console.warn("⚠️ MetaMask network changed.");

    // Reset Web3 contract state.
    if (typeof window.resetWalletState === "function") {
      try {
        window.resetWalletState();
      } catch (error) {
        console.warn("Could not reset Web3 state:", error);
      }
    }

    // Keep backend identity only if
    // your application intentionally permits
    // network switching.
    //
    // For blockchain operations, the Web3
    // layer must rebuild provider/signer/contract.

    if (!isPublicPage()) {
      showToast(
        "Blockchain network changed. Reconnecting to Web3...",
        "warning",
      );

      setTimeout(async () => {
        try {
          if (typeof window.ensureWeb3Ready === "function") {
            await window.ensureWeb3Ready();

            console.log("✅ Web3 reconnected after network change.");
          }
        } catch (error) {
          console.error("❌ Web3 reconnection failed:", error);

          clearAuthData();

          window.location.href = "/connect.html";
        }
      }, 1000);
    }
  });
}

// ============================================================
// EXPORT HELPER FOR BEARER AUTH API REQUESTS
// ============================================================

window.getAuthHeaders = function () {
  const token = getToken();

  if (!token) {
    return {
      "Content-Type": "application/json",
    };
  }

  return {
    "Content-Type": "application/json",

    Authorization: `Bearer ${token}`,
  };
};

// ============================================================
// EXPORT TOKEN HELPER
// ============================================================

window.getAuthToken = function () {
  return getToken();
};
