// ============================================================
// TRAXEN AUTHENTICATION + SESSION MANAGEMENT
// ============================================================
// Authentication architecture:
//
// REGISTER
//   MetaMask
//      ↓
//   Check Sepolia FIRST
//      ↓
//   Connect wallet
//      ↓
//   Select role + enter details
//      ↓
//   Check Sepolia AGAIN
//      ↓
//   Blockchain registration
//      ↓
//   Request nonce
//      ↓
//   MetaMask signs registration message
//      ↓
//   POST /api/auth/register
//      ↓
//   Backend verifies signature
//      ↓
//   Backend creates user + JWT
//
// LOGIN
//   MetaMask
//      ↓
//   Check Sepolia FIRST
//      ↓
//   Get wallet
//      ↓
//   Request nonce
//      ↓
//   MetaMask signs login message
//      ↓
//   POST /api/auth/login
//      ↓
//   Backend verifies signature
//      ↓
//   Backend returns JWT
//
// PROTECTED APPLICATION
//   JWT
//      ↓
//   MetaMask account check
//      ↓
//   Sepolia check
//      ↓
//   GET /api/users/me
//      Authorization: Bearer JWT
//      ↓
//   Backend validates JWT
//      ↓
//   req.user
//      ↓
//   Verify wallet + role
//      ↓
//   Web3/contract ready
// ============================================================

// ============================================================
// STORAGE KEYS
// ============================================================

const STORAGE_WALLET = "traxenWallet";
const STORAGE_ROLE = "traxenUserRole";
const STORAGE_NAME = "traxenUserName";
const STORAGE_EMAIL = "traxenUserEmail";
const STORAGE_TOKEN = "traxenAuthToken";

// ============================================================
// NETWORK CONFIGURATION
// ============================================================

// Sepolia decimal chain ID = 11155111
// MetaMask RPC requires hexadecimal:
// 11155111 = 0xaa36a7
const REQUIRED_CHAIN_ID = "0xaa36a7";

// ============================================================
// ROUTES
// ============================================================

const LOGIN_PATH = "/login";

// ============================================================
// PRIVATE STORAGE HELPERS
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
// STORE AUTHENTICATED DATA
// ============================================================

function setAuthData(wallet, role, name, email, token = null) {
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

  if (token) {
    localStorage.setItem(STORAGE_TOKEN, token);
  }
}

// ============================================================
// CLEAR AUTHENTICATION DATA
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
// PUBLIC PAGE CHECK
// ============================================================

function isPublicPage() {
  const path = window.location.pathname;

  return (
    path === "/" ||
    path === "/login" ||
    path === "/register" ||
    path === "/connect.html" ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/connect")
  );
}

// ============================================================
// ROLE FROM URL
// ============================================================

function getAllowedRolesForUrl(url) {
  if (url.includes("/shipper/") || url.includes("/shipper")) {
    return ["Shipper"];
  }

  if (url.includes("/carrier/") || url.includes("/carrier")) {
    return ["Carrier"];
  }

  return [];
}

// ============================================================
// BASIC AUTH GUARD
// ============================================================

function guard(allowedRoles) {
  const wallet = getWallet();
  const role = getRole();
  const token = getToken();

  if (!wallet || !role || !token) {
    window.location.replace(LOGIN_PATH);

    return false;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) {
      window.location.replace(LOGIN_PATH);

      return false;
    }
  }

  return true;
}

// ============================================================
// AUTO GUARD CURRENT PAGE
// ============================================================

function autoGuard() {
  if (isPublicPage()) {
    return true;
  }

  const allowedRoles = getAllowedRolesForUrl(window.location.pathname);

  return guard(allowedRoles);
}

// ============================================================
// ROLE GUARD FOR SPA URL
// ============================================================

function requireRoleForUrl(url) {
  if (!url) {
    return true;
  }

  if (isPublicPage()) {
    return true;
  }

  const allowedRoles = getAllowedRolesForUrl(url);

  return guard(allowedRoles);
}

// ============================================================
// ENSURE SEPOLIA NETWORK
// ============================================================
// used BEFORE login/register
//
// switchNetwork = true
//   → automatically request MetaMask switch
//
// switchNetwork = false
//   → do NOT automatically switch
//   → protected pages will fail if wrong network
// ============================================================

async function ensureSepoliaNetwork(switchNetwork = true) {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  // ----------------------------------------------------------
  // Check current chain
  // ----------------------------------------------------------

  const currentChainId = await window.ethereum.request({
    method: "eth_chainId",
  });

  console.log("🌐 Current MetaMask chain:", currentChainId);

  console.log("🌐 Required Sepolia chain:", REQUIRED_CHAIN_ID);

  // ----------------------------------------------------------
  // Already on Sepolia
  // ----------------------------------------------------------

  if (currentChainId.toLowerCase() === REQUIRED_CHAIN_ID) {
    console.log("✅ MetaMask is already on Sepolia.");

    return true;
  }

  // ----------------------------------------------------------
  // Protected pages can reject wrong network
  // ----------------------------------------------------------

  if (!switchNetwork) {
    throw new Error("Please switch MetaMask to the Sepolia network.");
  }

  // ----------------------------------------------------------
  // Login/Register:
  // request automatic network switch
  // ----------------------------------------------------------

  console.log("⚠️ Wrong network. Requesting switch to Sepolia...");

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",

      params: [
        {
          chainId: REQUIRED_CHAIN_ID,
        },
      ],
    });

    console.log("✅ MetaMask switched to Sepolia.");
  } catch (switchError) {
    console.error("❌ MetaMask network switch error:", switchError);

    console.error("Error code:", switchError?.code);

    console.error("Error message:", switchError?.message);

    // --------------------------------------------------------
    // User rejected
    // --------------------------------------------------------

    if (switchError?.code === 4001) {
      throw new Error("Please approve the MetaMask switch to Sepolia.");
    }

    // --------------------------------------------------------
    // Request already pending
    // --------------------------------------------------------

    if (switchError?.code === -32002) {
      throw new Error(
        "A MetaMask request is already pending. Please open MetaMask and approve or reject it.",
      );
    }

    // --------------------------------------------------------
    // Sepolia isn't added
    // --------------------------------------------------------

    if (switchError?.code === 4902) {
      console.log("⚠️ Sepolia is not added to MetaMask. Requesting add...");

      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",

          params: [
            {
              chainId: REQUIRED_CHAIN_ID,

              chainName: "Sepolia",

              nativeCurrency: {
                name: "Sepolia Ether",

                symbol: "ETH",

                decimals: 18,
              },

              rpcUrls: ["https://rpc.sepolia.org"],

              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });

        console.log("✅ Sepolia added to MetaMask.");
      } catch (addError) {
        console.error("❌ Add Sepolia error:", addError);

        if (addError?.code === 4001) {
          throw new Error("Please approve adding the Sepolia network.");
        }

        if (addError?.code === -32002) {
          throw new Error(
            "A MetaMask request is already pending. Please open MetaMask and finish it.",
          );
        }

        throw new Error(
          addError?.message || "MetaMask could not add the Sepolia network.",
        );
      }
    } else {
      throw new Error(
        switchError?.message ||
          `Unable to switch MetaMask to Sepolia. Error code: ${switchError?.code ?? "unknown"}`,
      );
    }
  }

  // ----------------------------------------------------------
  // Verify final network
  // ----------------------------------------------------------

  const finalChainId = await window.ethereum.request({
    method: "eth_chainId",
  });

  console.log("🌐 Final MetaMask chain:", finalChainId);

  if (finalChainId.toLowerCase() !== REQUIRED_CHAIN_ID) {
    throw new Error("MetaMask is still not connected to Sepolia.");
  }

  console.log("✅ Sepolia network verified.");

  return true;
}

// ============================================================
// REDIRECT AFTER AUTH FAILURE
// ============================================================

function redirectToLogin(message = null) {
  clearAuthData();

  if (typeof window.resetWalletState === "function") {
    try {
      window.resetWalletState();
    } catch (error) {
      console.warn("Could not reset Web3 state:", error);
    }
  }

  if (message && typeof window.showToast === "function") {
    window.showToast(message, "error");
  }

  window.location.replace(LOGIN_PATH);

  return false;
}

// ============================================================
// FULL PROTECTED SESSION VALIDATION
// ============================================================

async function ensureFullSession() {
  try {
    console.log("🔐 Checking full Traxen session...");

    // --------------------------------------------------------
    // 1. Get stored authentication data
    // --------------------------------------------------------

    const token = getToken();

    const wallet = getWallet();

    const role = getRole();

    if (!token || !wallet || !role) {
      return redirectToLogin("Please sign in to access this page.");
    }

    // --------------------------------------------------------
    // 2. MetaMask must exist
    // --------------------------------------------------------

    if (!window.ethereum) {
      return redirectToLogin("MetaMask is not available.");
    }

    // --------------------------------------------------------
    // 3. Protected page must be Sepolia
    // Don't silently switch an already authenticated user.
    // --------------------------------------------------------

    try {
      await ensureSepoliaNetwork(false);
    } catch (networkError) {
      return redirectToLogin(networkError.message);
    }

    // --------------------------------------------------------
    // 4. Check active MetaMask account
    // --------------------------------------------------------

    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    if (!accounts || accounts.length === 0) {
      return redirectToLogin(
        "Please connect your authenticated MetaMask account.",
      );
    }

    const currentWallet = accounts[0].toLowerCase();

    const authenticatedWallet = wallet.toLowerCase();

    console.log("🔐 Authenticated wallet:", authenticatedWallet);

    console.log("🔐 Current MetaMask wallet:", currentWallet);

    // --------------------------------------------------------
    // 5. Prevent account switching
    // --------------------------------------------------------

    if (currentWallet !== authenticatedWallet) {
      return redirectToLogin(
        "The active MetaMask account does not match your authenticated account.",
      );
    }

    console.log("✅ MetaMask account matches authenticated wallet.");

    // --------------------------------------------------------
    // 6. Ask backend to validate JWT
    // --------------------------------------------------------

    const meResponse = await fetch("/api/users/me", {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // --------------------------------------------------------
    // JWT rejected
    // --------------------------------------------------------

    if (!meResponse.ok) {
      console.warn("❌ Backend rejected JWT:", meResponse.status);

      return redirectToLogin("Your session is invalid or expired.");
    }

    const userData = await meResponse.json();

    // --------------------------------------------------------
    // 7. Verify backend wallet
    // --------------------------------------------------------

    if (!userData.wallet_address) {
      return redirectToLogin("Backend did not return an authenticated wallet.");
    }

    if (userData.wallet_address.toLowerCase() !== authenticatedWallet) {
      return redirectToLogin(
        "Backend wallet does not match the authenticated wallet.",
      );
    }

    // --------------------------------------------------------
    // 8. Verify backend role
    // --------------------------------------------------------

    if (userData.role !== role) {
      return redirectToLogin(
        "Backend role does not match the authenticated role.",
      );
    }

    console.log("✅ JWT authentication verified.");

    console.log("✅ Backend user verified.");

    console.log("✅ Authenticated role:", userData.role);

    // --------------------------------------------------------
    // 9. Make sure Web3 / contract is ready
    // --------------------------------------------------------

    if (typeof window.ensureWeb3Ready === "function") {
      try {
        const web3 = await window.ensureWeb3Ready();

        if (!web3 || !web3.contract) {
          throw new Error("Contract instance unavailable.");
        }

        console.log("✅ Web3 is ready.");

        console.log("✅ Contract is ready.");
      } catch (web3Error) {
        console.error("❌ Web3 initialization failed:", web3Error);

        return redirectToLogin("Blockchain connection is unavailable.");
      }
    }

    // --------------------------------------------------------
    // 10. Full session valid
    // --------------------------------------------------------

    console.log("✅ Full Traxen session verified.");

    return true;
  } catch (error) {
    console.error("❌ Full session verification failed:", error);

    return redirectToLogin(error.message || "Authentication failed.");
  }
}

// ============================================================
// PUBLIC AUTH OBJECT
// ============================================================

window.Auth = {
  isAuthenticated: () => !!getToken() && !!getWallet() && !!getRole(),

  getToken: getToken,

  getCurrentRole: getRole,

  getName: getName,

  getWallet: getWallet,

  getEmail: getEmail,

  setAuthData: setAuthData,

  clearAuthData: clearAuthData,

  ensureFullSession: ensureFullSession,

  ensureSepoliaNetwork: ensureSepoliaNetwork,

  guard: guard,

  autoGuard: autoGuard,

  requireRoleForUrl: requireRoleForUrl,

  logout: function () {
    clearAuthData();

    if (typeof window.resetWalletState === "function") {
      try {
        window.resetWalletState();
      } catch (error) {
        console.warn("Could not reset Web3 state:", error);
      }
    }

    window.location.replace("/");
  },
};

// ============================================================
// RUN LOCAL GUARD IMMEDIATELY
// ============================================================

autoGuard();

// ============================================================
// LOGIN / REGISTER UI
// ============================================================

let selectedRole = null;

// ============================================================
// PASSWORD TOGGLE
// ============================================================

function togglePw(id) {
  const element = document.getElementById(id);

  if (element) {
    element.type = element.type === "password" ? "text" : "password";
  }
}

// ============================================================
// REGISTRATION STEP CONTROL
// ============================================================

function goRegStep(step) {
  [1, 2, 3].forEach((index) => {
    const element = document.getElementById(`reg-step-${index}`);

    if (element) {
      element.classList.toggle("active", index === step);
    }
  });

  document.querySelectorAll("#regDots .dot-bar").forEach((dot, index) => {
    dot.classList.toggle("on", index < step);
  });
}

// ============================================================
// ROLE SELECTION
// ============================================================

function selectRole(element) {
  if (!element) {
    return;
  }

  document.querySelectorAll(".role-card").forEach((card) => {
    card.classList.remove("selected");
  });

  element.classList.add("selected");

  selectedRole = element.dataset.role;

  const continueButton = document.getElementById("regRoleContinue");

  if (continueButton) {
    continueButton.disabled = false;
  }
}

// ============================================================
// REGISTER WALLET CONNECTION
// IMPORTANT:
// NETWORK CHECK IS THE FIRST BLOCKCHAIN ACTION.
// ============================================================

async function handleRegisterWalletConnection(element) {
  try {
    // --------------------------------------------------------
    // FIRST: MetaMask
    // --------------------------------------------------------

    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    // --------------------------------------------------------
    // FIRST NETWORK CHECK
    // BEFORE CONNECTING
    // --------------------------------------------------------

    console.log("🌐 Checking network before registration...");

    await ensureSepoliaNetwork(true);

    // --------------------------------------------------------
    // Connect wallet
    // --------------------------------------------------------

    const address = await connectWallet();

    // --------------------------------------------------------
    // UI
    // --------------------------------------------------------

    document.querySelectorAll(".wallet-opt").forEach((wallet) => {
      wallet.classList.remove("selected");
    });

    if (element) {
      element.classList.add("selected");
    }

    const walletAddressEl = document.getElementById("regWalletAddr");

    if (walletAddressEl) {
      walletAddressEl.textContent = address;
    }

    const status = document.getElementById("regWalletStatus");

    if (status) {
      status.className = "status-line connected";

      status.innerHTML =
        '<div class="status-dot"></div>' + "<span>Connected</span>";
    }

    setTimeout(() => goRegStep(2), 500);
  } catch (error) {
    console.error("❌ Registration wallet connection error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Unable to connect wallet.", "error");
    }
  }
}

// ============================================================
// REGISTRATION
// ============================================================

async function finishRegister() {
  try {
    // --------------------------------------------------------
    // 1. MetaMask
    // --------------------------------------------------------

    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    // --------------------------------------------------------
    // 2. NETWORK CHECK AGAIN
    // User could have changed network while entering details.
    // --------------------------------------------------------

    console.log("🌐 Rechecking network before registration submission...");

    await ensureSepoliaNetwork(true);

    // --------------------------------------------------------
    // 3. Get form values
    // --------------------------------------------------------

    const nameElement = document.getElementById("regDisplayName");

    const emailElement = document.getElementById("regEmail");

    const name = nameElement ? nameElement.value.trim() : "";

    const email = emailElement ? emailElement.value.trim() : "";

    // --------------------------------------------------------
    // 4. Validate name
    // --------------------------------------------------------

    if (!name) {
      showToast("Please enter your display name.", "warning");

      return;
    }

    // --------------------------------------------------------
    // 5. Validate email
    // --------------------------------------------------------

    if (!email) {
      showToast("Please enter your email.", "warning");

      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Please enter a valid email address.", "warning");

      return;
    }

    // --------------------------------------------------------
    // 6. Validate role
    // --------------------------------------------------------

    if (!selectedRole || !["Shipper", "Carrier"].includes(selectedRole)) {
      showToast("Please select a valid role.", "warning");

      goRegStep(2);

      return;
    }

    // --------------------------------------------------------
    // 7. Get active MetaMask wallet
    // --------------------------------------------------------

    const provider = new ethers.BrowserProvider(window.ethereum);

    const signer = await provider.getSigner();

    const walletAddress = await signer.getAddress();

    console.log("🔐 Registration wallet:", walletAddress);

    // --------------------------------------------------------
    // 8. Blockchain registration
    // --------------------------------------------------------

    let blockchainResult;

    try {
      blockchainResult = await registerBlockchainUser(selectedRole);
    } catch (blockchainError) {
      const message = blockchainError?.message || "";

      // Existing blockchain account
      // can continue to backend authentication.
      if (message.toLowerCase().includes("already registered")) {
        console.warn("⚠️ Wallet already registered on blockchain.");

        blockchainResult = {
          wallet: walletAddress,
        };
      } else {
        throw blockchainError;
      }
    }

    const authenticatedWallet = blockchainResult?.wallet || walletAddress;

    // --------------------------------------------------------
    // 9. Confirm wallet did not change
    // --------------------------------------------------------

    if (authenticatedWallet.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error(
        "Registration wallet does not match the active MetaMask account.",
      );
    }

    // --------------------------------------------------------
    // 10. Request fresh nonce
    // --------------------------------------------------------

    console.log("🔐 Requesting registration nonce...");

    const nonceResponse = await fetch(
      `/api/auth/nonce/${authenticatedWallet}`,
      {
        method: "GET",
      },
    );

    const nonceData = await nonceResponse.json();

    if (!nonceResponse.ok || !nonceData.success || !nonceData.nonce) {
      throw new Error(
        nonceData.message || "Failed to generate registration nonce.",
      );
    }

    const nonce = nonceData.nonce;

    // --------------------------------------------------------
    // 11. Create exact registration message
    // --------------------------------------------------------

    const message =
      `Traxen Account Registration\n\n` +
      `Please sign this message to verify that you control this wallet.\n\n` +
      `This signature does not send a transaction and does not cost gas.\n\n` +
      `Nonce: ${nonce}`;

    // --------------------------------------------------------
    // 12. MetaMask signature
    // --------------------------------------------------------

    console.log("✍️ Requesting registration signature...");

    const signature = await signer.signMessage(message);

    console.log("✅ Registration signature created.");

    // --------------------------------------------------------
    // 13. Send to backend
    // --------------------------------------------------------

    const dbResponse = await fetch("/api/auth/register", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        walletAddress: authenticatedWallet,

        role: selectedRole,

        displayName: name,

        email: email,

        signature: signature,

        message: message,
      }),
    });

    const data = await dbResponse.json();

    // --------------------------------------------------------
    // 14. Backend result
    // --------------------------------------------------------

    if (!dbResponse.ok || !data.success) {
      // If backend says account already exists,
      // registration should NOT silently create a second account.
      throw new Error(data.message || "Registration failed.");
    }

    // --------------------------------------------------------
    // 15. JWT must exist
    // --------------------------------------------------------

    if (!data.token) {
      throw new Error(
        "Registration succeeded but the server did not return a JWT.",
      );
    }

    // --------------------------------------------------------
    // 16. User data must exist
    // --------------------------------------------------------

    if (!data.user) {
      throw new Error(
        "Registration succeeded but user information was not returned.",
      );
    }

    // --------------------------------------------------------
    // 17. Store JWT + authenticated user
    // --------------------------------------------------------

    setAuthData(
      data.user.wallet_address || authenticatedWallet,

      data.user.role || selectedRole,

      data.user.display_name || name,

      data.user.email || email,

      data.token,
    );

    console.log("✅ Registration JWT stored.");

    console.log("✅ Registration session established.");

    // --------------------------------------------------------
    // 18. Success
    // --------------------------------------------------------

    showToast(`Account created successfully as ${selectedRole}!`, "success");

    // --------------------------------------------------------
    // 19. Role-based redirect
    // --------------------------------------------------------

    setTimeout(() => {
      if (selectedRole === "Carrier") {
        window.location.replace("/carrier/carrier_dashboard.html");

        return;
      }

      if (selectedRole === "Shipper") {
        window.location.replace("/shipper/shipper_dashboard.html");

        return;
      }

      clearAuthData();

      window.location.replace(LOGIN_PATH);
    }, 1200);
  } catch (error) {
    console.error("❌ Registration error:", error);

    if (typeof showToast === "function") {
      showToast(
        error.reason || error.message || "Registration failed.",
        "error",
      );
    }
  }
}

// ============================================================
// LOGIN
// IMPORTANT:
// NETWORK CHECK IS THE FIRST BLOCKCHAIN ACTION.
// ============================================================

async function handleLogin() {
  try {
    // --------------------------------------------------------
    // 1. MetaMask
    // --------------------------------------------------------

    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    // --------------------------------------------------------
    // 2. NETWORK CHECK FIRST
    // --------------------------------------------------------

    console.log("🌐 Checking network before login...");

    await ensureSepoliaNetwork(true);

    // --------------------------------------------------------
    // 3. Request wallet access if necessary
    // --------------------------------------------------------

    let accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    if (!accounts || accounts.length === 0) {
      accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
    }

    if (!accounts || accounts.length === 0) {
      throw new Error("No MetaMask account is connected.");
    }

    // --------------------------------------------------------
    // 4. Get signer
    // --------------------------------------------------------

    const provider = new ethers.BrowserProvider(window.ethereum);

    const signer = await provider.getSigner();

    const walletAddress = await signer.getAddress();

    console.log("🔐 Login wallet:", walletAddress);

    if (typeof showToast === "function") {
      showToast("Verifying your wallet...", "info");
    }

    // --------------------------------------------------------
    // 5. Request fresh nonce
    // --------------------------------------------------------

    console.log("🔐 Requesting login nonce...");

    const nonceResponse = await fetch(`/api/auth/nonce/${walletAddress}`, {
      method: "GET",
    });

    const nonceData = await nonceResponse.json();

    if (!nonceResponse.ok || !nonceData.success || !nonceData.nonce) {
      throw new Error(nonceData.message || "Failed to generate login nonce.");
    }

    const nonce = nonceData.nonce;

    // --------------------------------------------------------
    // 6. Exact login message
    // --------------------------------------------------------

    const message =
      `Traxen Login Verification\n\n` +
      `Please sign this message to verify that you control this wallet.\n\n` +
      `This signature does not send a transaction and does not cost gas.\n\n` +
      `Nonce: ${nonce}`;

    // --------------------------------------------------------
    // 7. MetaMask signature
    // --------------------------------------------------------

    console.log("✍️ Requesting login signature...");

    const signature = await signer.signMessage(message);

    console.log("✅ Login signature created.");

    // --------------------------------------------------------
    // 8. Send login to backend
    // --------------------------------------------------------

    const loginResponse = await fetch("/api/auth/login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        walletAddress: walletAddress,

        signature: signature,

        message: message,
      }),
    });

    const data = await loginResponse.json();

    // --------------------------------------------------------
    // 9. Backend result
    // --------------------------------------------------------

    if (!loginResponse.ok || !data.success) {
      throw new Error(data.message || "Login failed.");
    }

    // --------------------------------------------------------
    // 10. JWT must exist
    // --------------------------------------------------------

    if (!data.token) {
      throw new Error("Login succeeded but the server did not return a JWT.");
    }

    // --------------------------------------------------------
    // 11. User must exist
    // --------------------------------------------------------

    if (!data.user) {
      throw new Error(
        "Login succeeded but the server did not return user information.",
      );
    }

    // --------------------------------------------------------
    // 12. Store JWT + authenticated user
    // --------------------------------------------------------

    setAuthData(
      data.user.wallet_address || walletAddress,

      data.user.role,

      data.user.display_name || "User",

      data.user.email || "",

      data.token,
    );

    console.log("✅ Login JWT stored.");

    console.log("✅ Authenticated wallet:", data.user.wallet_address);

    console.log("✅ Authenticated role:", data.user.role);

    // --------------------------------------------------------
    // 13. Success
    // --------------------------------------------------------

    showToast("Login successful! Redirecting...", "success");

    // --------------------------------------------------------
    // 14. Redirect based on BACKEND role
    // --------------------------------------------------------

    setTimeout(() => {
      if (data.user.role === "Carrier") {
        window.location.replace("/carrier/carrier_dashboard.html");

        return;
      }

      if (data.user.role === "Shipper") {
        window.location.replace("/shipper/shipper_dashboard.html");

        return;
      }

      console.error("Unknown backend role:", data.user.role);

      clearAuthData();

      window.location.replace(LOGIN_PATH);
    }, 900);
  } catch (error) {
    console.error("❌ Login error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Unable to complete login.", "error");
    }
  }
}

// ============================================================
// LOGIN BUTTON COMPATIBILITY
// ============================================================

function doLogin() {
  return handleLogin();
}

// ============================================================
// WALLET SELECTION UI
// ============================================================

function selectWallet(element, context) {
  if (!element) {
    return;
  }

  if (element.classList.contains("disabled")) {
    return;
  }

  document.querySelectorAll(".wallet-opt").forEach((wallet) => {
    wallet.classList.remove("selected");
  });

  element.classList.add("selected");

  const status = document.getElementById(`${context}WalletStatus`);

  const walletName =
    element.querySelector(".wallet-name")?.textContent || "wallet";

  if (status) {
    status.className = "status-line connecting";

    status.innerHTML =
      '<div class="status-dot"></div>' +
      `<span>Connecting to ${walletName}…</span>`;
  }

  setTimeout(async () => {
    try {
      if (context === "reg") {
        await handleRegisterWalletConnection(element);
      }

      if (context === "login") {
        await handleLogin();
      }
    } catch (error) {
      console.error("Wallet selection error:", error);
    }
  }, 150);
}

// ============================================================
// LOGOUT
// ============================================================

function handleLogout(event) {
  if (event) {
    event.preventDefault();
  }

  window.Auth.logout();
}

// ============================================================
// SERVER HEALTH CHECK
// ============================================================

async function checkServerAndSession() {
  const publicPage = isPublicPage();

  async function checkHealth() {
    try {
      const response = await fetch("/api/health", {
        method: "GET",
      });

      return response.ok;
    } catch (error) {
      console.error("Health check failed:", error);

      return false;
    }
  }

  let healthy = false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    healthy = await checkHealth();

    if (healthy) {
      break;
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  if (!healthy) {
    clearAuthData();

    if (!publicPage) {
      window.location.replace(LOGIN_PATH);
    } else if (typeof showToast === "function") {
      showToast("Server is unreachable. Please try again later.", "error");
    }

    return false;
  }

  // ----------------------------------------------------------
  // Public pages don't require an existing session
  // ----------------------------------------------------------

  if (publicPage) {
    return true;
  }

  // ----------------------------------------------------------
  // Protected pages require full session validation
  // ----------------------------------------------------------

  return ensureFullSession();
}

// ============================================================
// DOM READY
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  if (document.getElementById("reg-step-1")) {
    goRegStep(1);
  }

  try {
    await checkServerAndSession();
  } catch (error) {
    console.error("❌ Startup authentication check failed:", error);
  }
});

// ============================================================
// METAMASK ACCOUNT CHANGES
// ============================================================

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    console.warn("⚠️ MetaMask accounts changed:", accounts);

    // ------------------------------------------------------
    // No account
    // ------------------------------------------------------

    if (!accounts || accounts.length === 0) {
      if (!isPublicPage()) {
        clearAuthData();

        window.location.replace(LOGIN_PATH);
      }

      return;
    }

    // ------------------------------------------------------
    // Compare against authenticated wallet
    // ------------------------------------------------------

    const authenticatedWallet = getWallet();

    if (
      authenticatedWallet &&
      accounts[0].toLowerCase() !== authenticatedWallet.toLowerCase()
    ) {
      console.warn("❌ MetaMask account switched.");

      clearAuthData();

      if (typeof window.resetWalletState === "function") {
        try {
          window.resetWalletState();
        } catch (error) {
          console.warn("Could not reset Web3 state:", error);
        }
      }

      if (!isPublicPage()) {
        window.location.replace(LOGIN_PATH);
      }
    }
  });

  // ==========================================================
  // METAMASK NETWORK CHANGE
  // ==========================================================

  window.ethereum.on("chainChanged", async (chainId) => {
    console.warn("⚠️ MetaMask network changed:", chainId);

    if (typeof window.resetWalletState === "function") {
      try {
        window.resetWalletState();
      } catch (error) {
        console.warn("Could not reset Web3 state:", error);
      }
    }

    // ------------------------------------------------------
    // Public login/register page
    //
    // Do not destroy anything here.
    // Login/register will check/switch network when clicked.
    // ------------------------------------------------------

    if (isPublicPage()) {
      return;
    }

    // ------------------------------------------------------
    // Protected page
    //
    // Wrong network invalidates this session.
    // ------------------------------------------------------

    if (chainId.toLowerCase() !== REQUIRED_CHAIN_ID) {
      clearAuthData();

      if (typeof showToast === "function") {
        showToast("Please reconnect using the Sepolia network.", "error");
      }

      window.location.replace(LOGIN_PATH);

      return;
    }

    // ------------------------------------------------------
    // Correct network
    // Rebuild Web3 state.
    // ------------------------------------------------------

    try {
      if (typeof window.ensureWeb3Ready === "function") {
        await window.ensureWeb3Ready();

        console.log("✅ Web3 reconnected after network change.");
      }
    } catch (error) {
      console.error("❌ Web3 reconnection failed:", error);

      clearAuthData();

      window.location.replace(LOGIN_PATH);
    }
  });
}

// ============================================================
// AUTH HEADERS FOR PROTECTED API REQUESTS
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
// TOKEN HELPER
// ============================================================

window.getAuthToken = function () {
  return getToken();
};
