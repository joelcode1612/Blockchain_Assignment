/**
 * ============================================================
 * web3_integration.js
 * ============================================================
 *
 * Traxen Blockchain Integration
 *
 * Technology:
 * - MetaMask
 * - ethers.js v6
 * - Truffle
 * - LogisticsEscrow.sol
 *
 * ============================================================
 */

/* ============================================================
   CONFIGURATION
   ============================================================ */

const CONFIG = {
  contractAddress: "0x9972D19Df7884931a12146C66D89e126A643FC4F", // Update with your deployed contract address (public network)
  abiPath: "/abi/LogisticsEscrow.json",
};

/* ============================================================
   GLOBAL STATE
   ============================================================ */

let provider = null;
let signer = null;
let contractInstance = null;
let userWalletAddress = null;
let isWalletConnected = false;
let isInitializing = false;

async function reconnectWeb3() {
  if (isConnected()) return true;
  if (userWalletAddress && !contractInstance) {
    try { await initContract(); return true; } catch (e) { return false; }
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
      window.dispatchEvent(new CustomEvent("walletConnected", { detail: { address: userWalletAddress } }));
      await initContract();
      return true;
    }
  } catch (e) { console.error("Reconnect failed:", e); }
  return false;
}
window.reconnectWeb3 = reconnectWeb3;

/* ============================================================
   LOAD TRUFFLE ABI
   ============================================================ */

async function loadContractABI() {
  const response = await fetch(CONFIG.abiPath);
  if (!response.ok) throw new Error("Unable to load LogisticsEscrow ABI.");
  const artifact = await response.json();
  if (!artifact.abi || !Array.isArray(artifact.abi)) {
    throw new Error("Invalid Truffle ABI format.");
  }
  return artifact.abi;
}

/* ============================================================
   CHECK METAMASK
   ============================================================ */

function checkMetaMask() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask.");
  }
  return true;
}

/* ============================================================
   GET CURRENT NETWORK
   ============================================================ */

async function getNetwork() {
  checkMetaMask();
  if (!provider) {
    provider = new ethers.BrowserProvider(window.ethereum);
  }
  const network = await provider.getNetwork();
  return network;
}

/* ============================================================
   NETWORK CHECK (optional – commented out for public networks)
   ============================================================ */
/*
async function checkNetwork() {
  const network = await getNetwork();
  const chainId = Number(network.chainId);
  console.log("🌐 Current Chain ID:", chainId);

  // You may add a list of supported public chain IDs here if needed.
  // For public networks, this check is often omitted.
  return true;
}
*/

/* ============================================================
   CONNECT METAMASK
   ============================================================ */
async function connectWallet() {
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
  showToast("Wallet connected: " + truncateAddress(userWalletAddress), "success");
  window.dispatchEvent(new CustomEvent("walletConnected", { detail: { address: userWalletAddress } }));
  return userWalletAddress;
}


// ─── Sync wallet to localStorage (for auth.js) ──────────
function syncWalletToStorage(address) {
  if (address) {
    localStorage.setItem('traxenWallet', address);
  } else {
    localStorage.removeItem('traxenWallet');
  }
}

/* ============================================================
   INITIALIZE SMART CONTRACT
   ============================================================ */

async function initContract() {
  isInitializing = true;
  try {
    if (!provider) provider = new ethers.BrowserProvider(window.ethereum);
    if (!signer) signer = await provider.getSigner();
    const abi = await loadContractABI();
    contractInstance = new ethers.Contract(CONFIG.contractAddress, abi, signer);
    window.contract = contractInstance;
    console.log("✅ Contract initialised.");
    return contractInstance;
  } catch (e) {
    console.error("Contract init failed:", e);
    throw e;
  } finally {
    isInitializing = false;
  }
}


/* ============================================================
   GETTERS
   ============================================================ */

function getContract() {
  if (!contractInstance) throw new Error("Contract not initialised.");
  return contractInstance;
}
function getWalletAddress() { return userWalletAddress; }
function isConnected() { return userWalletAddress !== null && contractInstance !== null; }

/* ============================================================
   USER MODULE
   ============================================================ */

async function registerBlockchainUser(role) {
  try {
    if (!isConnected()) {
      await connectWallet();
    }
    const contract = getContract();

    let roleNumber;
    if (typeof role === "string") {
      const normalizedRole = role.toLowerCase();
      if (normalizedRole === "shipper") roleNumber = 1;
      else if (normalizedRole === "carrier") roleNumber = 2;
      else throw new Error("Invalid role.");
    } else {
      roleNumber = Number(role);
    }

    if (roleNumber !== 1 && roleNumber !== 2) {
      throw new Error("Invalid role. Use Shipper or Carrier.");
    }

    const alreadyRegistered = await contract.isRegistered(userWalletAddress);
    if (alreadyRegistered) {
      throw new Error("This wallet is already registered.");
    }

    console.log("📝 Registering user on Blockchain...");
    console.log("Wallet:", userWalletAddress);
    console.log("Role:", roleNumber);

    const transaction = await contract.registerUser(roleNumber);

    console.log("⏳ Registration transaction:", transaction.hash);
    const receipt = await transaction.wait();
    console.log("✅ Registration confirmed.");
    console.log("Receipt:", receipt);

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
      wallet: userWalletAddress,
    };
  } catch (error) {
    console.error("❌ Registration failed:", error);
    handleBlockchainError(error, "Registration failed.");
    throw error;
  }
}

/* ============================================================
   LOGIN
   ============================================================ */

async function blockchainLogin() {
  try {
    if (!isConnected()) {
      await connectWallet();
    }
    const contract = getContract();
    const result = await contract.login();
    const authenticated = result[0];
    const roleNumber = Number(result[1]);

    console.log("Authenticated:", authenticated);
    console.log("Role:", roleNumber);

    if (!authenticated) {
      return { success: false, authenticated: false, role: null };
    }

    let role;
    if (roleNumber === 1) role = "Shipper";
    else if (roleNumber === 2) role = "Carrier";
    else role = null;

    return {
      success: true,
      authenticated: true,
      role: role,
      roleNumber: roleNumber,
      wallet: userWalletAddress,
    };
  } catch (error) {
    console.error("❌ Blockchain login failed:", error);
    handleBlockchainError(error, "Login failed.");
    throw error;
  }
}

async function checkUserRegistered(walletAddress = null) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const address = walletAddress || userWalletAddress;
    return await contract.isRegistered(address);
  } catch (error) {
    console.error("❌ Registration check failed:", error);
    throw error;
  }
}

async function getUserRole(walletAddress = null) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const address = walletAddress || userWalletAddress;
    const roleNumber = Number(await contract.getRole(address));

    return {
      roleNumber: roleNumber,
      role: roleNumberToName(roleNumber),
    };
  } catch (error) {
    console.error("❌ Failed to get role:", error);
    throw error;
  }
}

/* ============================================================
   ROLE & STATUS CONVERSION HELPERS
   ============================================================ */

function roleNumberToName(roleNumber) {
  switch (Number(roleNumber)) {
    case 1:
      return "Shipper";
    case 2:
      return "Carrier";
    default:
      return "None";
  }
}

function agreementStatusToName(status) {
  const statuses = [
    "PendingAcceptance",
    "AwaitingFunding",
    "Active",
    "Completed",
    "Rejected",
    "Cancelled",
    "Refunded",
    "Expired",
  ];
  return statuses[Number(status)] || "Unknown";
}

function milestoneStatusToName(status) {
  const statuses = ["Pending", "Submitted", "Verified", "Paid"];
  return statuses[Number(status)] || "Unknown";
}

function paymentStatusToName(status) {
  const statuses = ["Pending", "Released", "Refunded"];
  return statuses[Number(status)] || "Unknown";
}

async function createAgreement(
  carrierAddress,
  escrowAmount,
  deadline,
  milestoneDescriptions,
  paymentPercentages
) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const escrowWei = ethers.parseEther(String(escrowAmount));

    const transaction = await contract.createAgreement(
      carrierAddress,
      escrowWei,
      deadline,
      milestoneDescriptions,
      paymentPercentages
    );

    console.log("⏳ Agreement transaction:", transaction.hash);
    const receipt = await transaction.wait();
    console.log("✅ Agreement created.");

    const agreementCount = await contract.getAgreementCount();

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
      agreementId: Number(agreementCount),
    };
  } catch (error) {
    console.error("❌ Create agreement failed:", error);
    handleBlockchainError(error, "Failed to create agreement.");
    throw error;
  }
}

async function getAgreement(agreementId) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const result = await contract.getAgreement(agreementId);

    return {
      agreementId: Number(result[0]),
      shipper: result[1],
      carrier: result[2],
      escrowAmountWei: result[3].toString(),
      escrowAmountETH: ethers.formatEther(result[3]),
      releasedAmountWei: result[4].toString(),
      releasedAmountETH: ethers.formatEther(result[4]),
      deadline: Number(result[5]),
      status: Number(result[6]),
      statusName: agreementStatusToName(Number(result[6])),
      createdAt: Number(result[7]),
      carrierAccepted: result[8],
      refundExecuted: result[9],
      milestoneCount: Number(result[10]),
    };
  } catch (error) {
    console.error("❌ Failed to get agreement:", error);
    throw error;
  }
}

async function acceptAgreement(agreementId) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const transaction = await contract.acceptAgreement(agreementId);

    console.log("⏳ Accept transaction:", transaction.hash);
    const receipt = await transaction.wait();

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
    };
  } catch (error) {
    console.error("❌ Accept agreement failed:", error);
    handleBlockchainError(error, "Failed to accept agreement.");
    throw error;
  }
}

async function rejectAgreement(agreementId) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const transaction = await contract.rejectAgreement(agreementId);

    console.log("⏳ Reject transaction:", transaction.hash);
    const receipt = await transaction.wait();

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
    };
  } catch (error) {
    console.error("❌ Reject agreement failed:", error);
    handleBlockchainError(error, "Failed to reject agreement.");
    throw error;
  }
}

async function cancelAgreement(agreementId) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const transaction = await contract.cancelAgreement(agreementId);

    console.log("⏳ Cancel transaction:", transaction.hash);
    const receipt = await transaction.wait();

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
    };
  } catch (error) {
    console.error("❌ Cancel agreement failed:", error);
    handleBlockchainError(error, "Failed to cancel agreement.");
    throw error;
  }
}

/* ============================================================
   EXPIRY & REFUND
   ============================================================ */

async function markExpired(agreementId) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const transaction = await contract.markExpired(agreementId);
    console.log("⏳ Mark expired transaction:", transaction.hash);

    const receipt = await transaction.wait();
    console.log("✅ Agreement marked as expired.");

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
    };
  } catch (error) {
    console.error("❌ Mark expired failed:", error);
    handleBlockchainError(error, "Failed to mark agreement as expired.");
    throw error;
  }
}

async function refund(agreementId) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const transaction = await contract.refund(agreementId);
    console.log("⏳ Refund transaction:", transaction.hash);

    const receipt = await transaction.wait();
    console.log("✅ Refund executed successfully.");

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
    };
  } catch (error) {
    console.error("❌ Refund failed:", error);
    handleBlockchainError(error, "Failed to execute refund.");
    throw error;
  }
}

async function getMilestone(agreementId, milestoneId) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const result = await contract.getMilestone(agreementId, milestoneId);

    return {
      milestoneId: Number(result[0]),
      paymentPercentage: Number(result[1]),
      status: Number(result[2]),
      submittedAt: Number(result[3]),
      verifiedAt: Number(result[4]),
      paymentReleasedAt: Number(result[5]),
    };
  } catch (error) {
    console.error("❌ Failed to get milestone:", error);
    throw error;
  }
}

async function getEscrowBalance(agreementId) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const balance = await contract.getEscrowBalance(agreementId);

    return { wei: balance.toString(), eth: ethers.formatEther(balance) };
  } catch (error) {
    console.error("❌ Failed to get escrow balance:", error);
    throw error;
  }
}

/* ============================================================
   WALLET UI & LISTENERS
   ============================================================ */

function updateWalletUI(address) {
  const els = document.querySelectorAll(".wallet-addr, .wallet-chip, .connect-wallet-btn");
  els.forEach(el => {
    if (address) {
      el.classList.remove("disconnected");
      el.classList.add("connected");
      if (el.classList.contains("wallet-addr")) el.textContent = truncateAddress(address);
    } else {
      el.classList.remove("connected");
      el.classList.add("disconnected");
    }
  });
  document.querySelectorAll("[data-wallet-address]").forEach(e => {
    e.textContent = address ? truncateAddress(address) : "Not connected";
  });
}

function truncateAddress(address) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return address.substring(0, 6) + "..." + address.substring(address.length - 4);
}

function setupListeners() {
  if (!window.ethereum) return;

  window.ethereum.on("accountsChanged", async (accounts) => {
    console.log("🔄 Account changed:", accounts);

    // If no accounts -> disconnected
    if (accounts.length === 0) {
      if (typeof window.Auth?.clearAuthData === 'function') {
        window.Auth.clearAuthData();
      }
      userWalletAddress = null;
      signer = null;
      contractInstance = null;
      isWalletConnected = false;
      syncWalletToStorage(null);
      updateWalletUI(null);
      const current = window.location.pathname;
      if (!['/login', '/register', '/'].includes(current)) {
        window.location.href = '/login';
      }
      return;
    }

    const newAddress = accounts[0];
    // ✅ Ignore if it's the same account we already have
    if (userWalletAddress && newAddress.toLowerCase() === userWalletAddress.toLowerCase()) {
      console.log("Same account, ignoring.");
      return;
    }

    // New account – clear session and redirect
    console.log("New account detected – clearing session.");
    if (typeof window.Auth?.clearAuthData === 'function') {
      window.Auth.clearAuthData();
    }
    userWalletAddress = null;
    signer = null;
    contractInstance = null;
    isWalletConnected = false;
    syncWalletToStorage(null);
    updateWalletUI(null);
    if (!['/login', '/register', '/'].includes(window.location.pathname)) {
      window.location.href = '/login';
    }
  });

  window.ethereum.on("chainChanged", () => {
    console.log("⛓️ Network changed – reloading.");
    if (typeof window.Auth?.clearAuthData === 'function') {
      window.Auth.clearAuthData();
    }
    window.location.reload();
  });
}

async function initializeWeb3() {
  if (!window.ethereum) {
    console.warn("MetaMask not installed.");
    return;
  }
  setupListeners();

  const currentPath = window.location.pathname;
  const isPublic = ['/', '/login', '/register'].includes(currentPath) ||
    currentPath.startsWith('/login') || currentPath.startsWith('/register');

  if (isPublic) {
    console.log("Public page – no auto-connect.");
    return;
  }

  // Protected page – try silent restore
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
      // Clear auth and redirect
      if (typeof window.Auth?.clearAuthData === 'function') {
        window.Auth.clearAuthData();
      }
      syncWalletToStorage(null);
      if (!isPublic) window.location.href = '/login';
    }
  } else {
    console.log("No account – redirect to login.");
    if (!isPublic) window.location.href = '/login';
  }
}

function handleBlockchainError(error, defaultMessage) {
  let message = defaultMessage;
  if (error && error.code === 4001) {
    message = "Transaction rejected in MetaMask.";
  } else if (error && error.code === "ACTION_REJECTED") {
    message = "Transaction rejected in MetaMask.";
  } else if (error && error.reason) {
    message = error.reason;
  } else if (
    error &&
    error.info &&
    error.info.error &&
    error.info.error.message
  ) {
    message = error.info.error.message;
  }
  console.error("Blockchain error:", error);
  showToast(message, "error");
}

function showToast(msg, type = "info") {
  if (typeof window.showToast === 'function') {
    window.showToast(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}

/* ============================================================
   MILESTONE OPERATIONS
   ============================================================ */

async function submitMilestone(agreementId, milestoneId) {
  try {
    if (!isConnected()) await connectWallet();

    const contract = getContract();

    const transaction = await contract.submitMilestone(agreementId, milestoneId);

    console.log("Submit milestone transaction:", transaction.hash);

    const receipt = await transaction.wait();

    console.log("Milestone submitted.");

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
    };
  } catch (error) {
    console.error("Submit milestone failed:", error);
    handleBlockchainError(error, "Failed to submit milestone.");
    throw error;
  }
}

async function verifyMilestone(agreementId, milestoneId) {
  try {
    if (!isConnected()) await connectWallet();

    const contract = getContract();

    const transaction = await contract.verifyMilestone(agreementId, milestoneId);

    console.log("Verify milestone transaction:", transaction.hash);

    const receipt = await transaction.wait();

    console.log("Milestone verified.");

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
    };
  } catch (error) {
    console.error("Verify milestone failed:", error);
    handleBlockchainError(error, "Failed to verify milestone.");
    throw error;
  }
}

async function releasePayment(agreementId, milestoneId) {
  try {
    if (!isConnected()) await connectWallet();

    const contract = getContract();

    const transaction = await contract.releasePayment(agreementId, milestoneId);

    console.log("Release payment transaction:", transaction.hash);

    const receipt = await transaction.wait();

    console.log("Payment released.");

    return {
      success: true,
      transactionHash: transaction.hash,
      receipt: receipt,
    };
  } catch (error) {
    console.error("Release payment failed:", error);
    handleBlockchainError(error, "Failed to release payment.");
    throw error;
  }
}

/* ============================================================
   ADDITIONAL QUERY FUNCTIONS (public network ready)
   ============================================================ */

// ─── GET ALL AGREEMENTS FOR A SHIPPER ──────────────────────
async function getAgreementsByShipper(shipperAddress) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const count = Number(await contract.getAgreementCount());
    const agreements = [];
    const shipperLower = shipperAddress.toLowerCase();

    for (let i = 1; i <= count; i++) {
      try {
        const ag = await contract.getAgreement(i);
        if (ag.shipper.toLowerCase() === shipperLower) {
          agreements.push({
            id: i,
            shipper: ag.shipper,
            carrier: ag.carrier,
            escrowAmountWei: ag.escrowAmount.toString(),
            escrowAmountETH: ethers.formatEther(ag.escrowAmount),
            releasedAmountWei: ag.releasedAmount.toString(),
            releasedAmountETH: ethers.formatEther(ag.releasedAmount),
            deadline: Number(ag.deadline),
            status: Number(ag.status),
            statusName: agreementStatusToName(Number(ag.status)),
            createdAt: Number(ag.createdAt),
            carrierAccepted: ag.carrierAccepted,
            refundExecuted: ag.refundExecuted,
            milestoneCount: Number(ag.milestoneCount),
          });
        }
      } catch (innerErr) {
        // Some agreements might be invalid or not exist; skip them.
        console.warn(`Skipping agreement ${i}:`, innerErr.message);
      }
    }
    return agreements;
  } catch (error) {
    console.error("❌ Failed to get agreements by shipper:", error);
    throw error;
  }
}

window.getAgreementsByShipper = getAgreementsByShipper;

// ─── GET ALL CARRIERS FROM AGREEMENTS ──────────────────────
async function getCarriersFromAgreements() {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const count = Number(await contract.getAgreementCount());
    const carrierSet = new Set();

    for (let i = 1; i <= count; i++) {
      try {
        const ag = await contract.getAgreement(i);
        carrierSet.add(ag.carrier.toLowerCase());
      } catch (innerErr) {
        console.warn(`Skipping agreement ${i}:`, innerErr.message);
      }
    }
    return Array.from(carrierSet);
  } catch (error) {
    console.error("❌ Failed to get carriers from agreements:", error);
    throw error;
  }
}

window.getCarriersFromAgreements = getCarriersFromAgreements;

// ─── GET AGREEMENTS FOR A WALLET (shipper OR carrier) ──────
async function getAgreementsByWallet(walletAddress) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const count = Number(await contract.getAgreementCount());
    const agreements = [];
    const targetLower = walletAddress.toLowerCase();

    for (let i = 1; i <= count; i++) {
      try {
        const ag = await contract.getAgreement(i);
        const shipper = ag.shipper.toLowerCase();
        const carrier = ag.carrier.toLowerCase();
        if (shipper === targetLower || carrier === targetLower) {
          agreements.push({
            id: i,
            shipper: ag.shipper,
            carrier: ag.carrier,
            escrowAmountWei: ag.escrowAmount.toString(),
            escrowAmountETH: ethers.formatEther(ag.escrowAmount),
            releasedAmountWei: ag.releasedAmount.toString(),
            releasedAmountETH: ethers.formatEther(ag.releasedAmount),
            deadline: Number(ag.deadline),
            status: Number(ag.status),
            statusName: agreementStatusToName(Number(ag.status)),
            createdAt: Number(ag.createdAt),
            carrierAccepted: ag.carrierAccepted,
            refundExecuted: ag.refundExecuted,
            milestoneCount: Number(ag.milestoneCount),
          });
        }
      } catch (innerErr) {
        console.warn(`Skipping agreement ${i}:`, innerErr.message);
      }
    }
    return agreements;
  } catch (error) {
    console.error("❌ Failed to get agreements by wallet:", error);
    throw error;
  }
}

window.getAgreementsByWallet = getAgreementsByWallet;

// ─── GET PENDING AGREEMENTS FOR A CARRIER ──────────────────
async function getPendingAgreementsForCarrier(carrierAddress) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const count = Number(await contract.getAgreementCount());
    const pending = [];
    const carrierLower = carrierAddress.toLowerCase();

    for (let i = 1; i <= count; i++) {
      try {
        const ag = await contract.getAgreement(i);
        const carrier = ag.carrier.toLowerCase();
        const status = Number(ag.status);
        // status 0 = PendingAcceptance (check your contract's enum)
        if (carrier === carrierLower && status === 0) {
          pending.push({
            id: i,
            shipper: ag.shipper,
            carrier: ag.carrier,
            escrowAmountWei: ag.escrowAmount.toString(),
            escrowAmountETH: ethers.formatEther(ag.escrowAmount),
            deadline: Number(ag.deadline),
            status: status,
            statusName: agreementStatusToName(status),
            milestoneCount: Number(ag.milestoneCount),
          });
        }
      } catch (innerErr) {
        console.warn(`Skipping agreement ${i}:`, innerErr.message);
      }
    }
    return pending;
  } catch (error) {
    console.error("❌ Failed to get pending agreements for carrier:", error);
    throw error;
  }
}

window.getPendingAgreementsForCarrier = getPendingAgreementsForCarrier;

/* ============================================================
   GLOBAL FUNCTIONS
   ============================================================ */

Object.defineProperty(window, "userWalletAddress", {
  get: () => userWalletAddress,
  set: (value) => {
    userWalletAddress = value;
  },
  configurable: true,
});

window.connectWallet = connectWallet;
window.initContract = initContract;
window.getContract = getContract;
window.getWalletAddress = getWalletAddress;
window.isConnected = isConnected;
window.reconnectWeb3 = reconnectWeb3;
window.truncateAddress = truncateAddress;
window.registerBlockchainUser = registerBlockchainUser;
window.blockchainLogin = blockchainLogin;
window.checkUserRegistered = checkUserRegistered;
window.getUserRole = getUserRole;
window.createAgreement = createAgreement;
window.getAgreement = getAgreement;
window.acceptAgreement = acceptAgreement;
window.rejectAgreement = rejectAgreement;
window.cancelAgreement = cancelAgreement;
window.getMilestone = getMilestone;
window.submitMilestone = submitMilestone;
window.verifyMilestone = verifyMilestone;
window.releasePayment = releasePayment;
window.getEscrowBalance = getEscrowBalance;
window.truncateAddress = truncateAddress;
window.roleNumberToName = roleNumberToName;
window.agreementStatusToName = agreementStatusToName;
window.milestoneStatusToName = milestoneStatusToName;
window.paymentStatusToName = paymentStatusToName;
window.markExpired = markExpired;
window.refund = refund;

/* ============================================================
   START WEB3
   ============================================================ */
window.isInitializing = isInitializing;
document.addEventListener("DOMContentLoaded", initializeWeb3);
window.__CONFIG = CONFIG;
window.__loadContractABI = loadContractABI;