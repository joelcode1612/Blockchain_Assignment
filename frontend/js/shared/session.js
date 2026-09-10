// ─── session.js ──────────────────────────────────────────────
// Single source of truth for:
//  - MetaMask connection (provider, signer, contract)
//  - User session (wallet, role, name, email)
// Both are kept in sync at all times.

// ─── Storage Keys ──────────────────────────────────────────
const STORAGE_WALLET = "traxenWallet";
const STORAGE_ROLE = "traxenUserRole";
const STORAGE_NAME = "traxenUserName";
const STORAGE_EMAIL = "traxenUserEmail";

// ─── Private State ─────────────────────────────────────────
let provider = null;
let signer = null;
let contractInstance = null;
let userWalletAddress = null;
let isWalletConnected = false;

// ─── Config ────────────────────────────────────────────────
const CONFIG = {
  contractAddress: "0xc56637c672ab37cc6545A42b1cf97a3CE9b4166a",
  abiPath: "/abi/LogisticsEscrow.json",
};

// ─── Private Helpers ──────────────────────────────────────

function getWalletFromStorage() {
  return localStorage.getItem(STORAGE_WALLET);
}
function getRoleFromStorage() {
  return localStorage.getItem(STORAGE_ROLE);
}
function getNameFromStorage() {
  return localStorage.getItem(STORAGE_NAME);
}
function getEmailFromStorage() {
  return localStorage.getItem(STORAGE_EMAIL);
}

function setAuthDataInStorage(wallet, role, name, email) {
  if (wallet) localStorage.setItem(STORAGE_WALLET, wallet);
  else localStorage.removeItem(STORAGE_WALLET);
  if (role) localStorage.setItem(STORAGE_ROLE, role);
  else localStorage.removeItem(STORAGE_ROLE);
  if (name) localStorage.setItem(STORAGE_NAME, name);
  else localStorage.removeItem(STORAGE_NAME);
  if (email) localStorage.setItem(STORAGE_EMAIL, email);
  else localStorage.removeItem(STORAGE_EMAIL);
}

function clearAuthDataInStorage() {
  localStorage.removeItem(STORAGE_WALLET);
  localStorage.removeItem(STORAGE_ROLE);
  localStorage.removeItem(STORAGE_NAME);
  localStorage.removeItem(STORAGE_EMAIL);
  sessionStorage.clear();
}

function syncWalletToStorage(address) {
  if (address) {
    localStorage.setItem(STORAGE_WALLET, address);
  } else {
    localStorage.removeItem(STORAGE_WALLET);
  }
}

// ─── Core Web3 Functions ──────────────────────────────────

async function loadContractABI() {
  const response = await fetch(CONFIG.abiPath);
  if (!response.ok) throw new Error("Unable to load LogisticsEscrow ABI.");
  const artifact = await response.json();
  if (!artifact.abi || !Array.isArray(artifact.abi)) {
    throw new Error("Invalid Truffle ABI format.");
  }
  return artifact.abi;
}

async function initContract() {
  if (!provider) {
    provider = new ethers.BrowserProvider(window.ethereum);
  }
  if (!signer) {
    signer = await provider.getSigner();
  }
  const abi = await loadContractABI();
  contractInstance = new ethers.Contract(CONFIG.contractAddress, abi, signer);
  window.contract = contractInstance;
  console.log("✅ Contract initialised.");
  return contractInstance;
}

// ─── Public API ─────────────────────────────────────────────

export async function connectWallet() {
  try {
    if (!window.ethereum) throw new Error("MetaMask not installed.");
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
    const accounts = await provider.send("eth_requestAccounts", []);
    if (!accounts || accounts.length === 0) throw new Error("No account selected.");

    signer = await provider.getSigner();
    userWalletAddress = await signer.getAddress();
    isWalletConnected = true;
    syncWalletToStorage(userWalletAddress);

    await initContract();
    updateWalletUI(userWalletAddress);
    return userWalletAddress;
  } catch (error) {
    console.error("Connect failed:", error);
    throw error;
  }
}

export async function reconnectWeb3() {
  // Already fully connected?
  if (isConnected()) return true;

  if (userWalletAddress && !contractInstance) {
    try {
      await initContract();
      return true;
    } catch (e) {
      console.error("Failed to re‑init contract:", e);
      return false;
    }
  }

  if (!window.ethereum) return false;

  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts && accounts.length > 0) {
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      userWalletAddress = accounts[0];
      isWalletConnected = true;
      syncWalletToStorage(userWalletAddress);
      updateWalletUI(userWalletAddress);
      await initContract();
      return true;
    }
  } catch (e) {
    console.error("Failed to restore wallet:", e);
  }
  return false;
}

export function getContract() {
  if (!contractInstance) throw new Error("Contract not initialised.");
  return contractInstance;
}

export function getWalletAddress() {
  return userWalletAddress;
}

export function isConnected() {
  return userWalletAddress !== null && contractInstance !== null;
}

// ─── Auth Session Functions ────────────────────────────────

export function getSession() {
  return {
    wallet: getWalletFromStorage(),
    role: getRoleFromStorage(),
    name: getNameFromStorage(),
    email: getEmailFromStorage(),
  };
}

export function setSession(wallet, role, name, email) {
  setAuthDataInStorage(wallet, role, name, email);
  // Also ensure the wallet address is in sync with the session
  if (wallet) syncWalletToStorage(wallet);
}

export function clearSession() {
  clearAuthDataInStorage();
  // Also reset Web3 state
  userWalletAddress = null;
  signer = null;
  contractInstance = null;
  isWalletConnected = false;
  provider = null;
  updateWalletUI(null);
}

export function isAuthenticated() {
  return !!getWalletFromStorage();
}

export function getRole() {
  return getRoleFromStorage();
}

export function getName() {
  return getNameFromStorage();
}

export function getEmail() {
  return getEmailFromStorage();
}

// ─── Wallet UI update ──────────────────────────────────────

function updateWalletUI(address) {
  const elements = document.querySelectorAll(".wallet-chip, .connect-wallet-btn, .wallet-addr");
  elements.forEach(el => {
    if (address) {
      el.classList.remove("disconnected");
      el.classList.add("connected");
      const addrEl = el.querySelector(".wallet-addr");
      if (addrEl) addrEl.textContent = truncateAddress(address);
    } else {
      el.classList.remove("connected");
      el.classList.add("disconnected");
    }
  });
  document.querySelectorAll("[data-wallet-address]").forEach(el => {
    el.textContent = address ? truncateAddress(address) : "Not connected";
  });
}

function truncateAddress(address) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return address.substring(0, 6) + "..." + address.substring(address.length - 4);
}

// ─── MetaMask Event Listeners ─────────────────────────────

function setupListeners() {
  if (!window.ethereum) return;
  window.ethereum.on("accountsChanged", async (accounts) => {
    console.log("🔄 Account changed:", accounts);
    if (accounts.length === 0) {
      // Disconnected – clear everything
      clearSession();
      if (!['/login', '/register', '/'].includes(window.location.pathname)) {
        window.location.href = '/login';
      }
      return;
    }
    // New account – clear session and redirect to login
    clearSession();
    // The new address will be picked up on the login page.
    if (!['/login', '/register', '/'].includes(window.location.pathname)) {
      window.location.href = '/login';
    }
  });

  window.ethereum.on("chainChanged", () => {
    console.log("⛓️ Network changed. Reloading.");
    // Optionally clear session and redirect
    clearSession();
    window.location.reload();
  });
}

// ─── Initialisation ─────────────────────────────────────────

export async function initSession() {
  setupListeners();

  // If on public page, don't auto‑connect
  const currentPath = window.location.pathname;
  const publicPaths = ['/', '/login', '/register'];
  if (publicPaths.includes(currentPath) || currentPath.startsWith('/login') || currentPath.startsWith('/register')) {
    console.log("Public page – wallet will not auto-connect.");
    return;
  }

  // Protected page – try to restore silently
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  if (accounts && accounts.length > 0) {
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      userWalletAddress = accounts[0];
      isWalletConnected = true;
      syncWalletToStorage(userWalletAddress);
      updateWalletUI(userWalletAddress);
      await initContract();
      console.log("✅ Session restored.");
    } catch (err) {
      console.error("Session restoration failed:", err);
      // Contract failed – clear and redirect
      clearSession();
      if (!publicPaths.includes(currentPath)) {
        window.location.href = '/login';
      }
    }
  } else {
    console.log("No account – redirecting to login.");
    if (!publicPaths.includes(currentPath)) {
      window.location.href = '/login';
    }
  }
}

// ─── Global exposure for backward compatibility ──────────
window.Session = {
  connectWallet,
  reconnectWeb3,
  getContract,
  getWalletAddress,
  isConnected,
  setSession,
  clearSession,
  isAuthenticated,
  getRole,
  getName,
  getEmail,
  getSession,
  initSession,
};

// Auto‑init on DOM ready
document.addEventListener("DOMContentLoaded", initSession);