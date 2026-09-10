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
  contractAddress: "0xc56637c672ab37cc6545A42b1cf97a3CE9b4166a", // Update with your deployed contract address (public network)
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
let isConnecting = false;

/* ============================================================
   RETRY & CACHE HELPERS
   ============================================================ */

const _cache = {};

async function fetchWithRetry(fn, retries = 3, delay = 500) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      console.warn(`⏳ Attempt ${i+1} failed:`, e.message);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function cacheKey(prefix, ...args) {
  return `${prefix}:${args.join('|')}`;
}

async function withCache(prefix, args, fn) {
  const key = cacheKey(prefix, ...args);
  if (_cache[key]) {
    console.log(`📦 Cache hit for ${key}`);
    return _cache[key];
  }
  try {
    const result = await fetchWithRetry(fn, 3, 500);
    _cache[key] = result;
    return result;
  } catch (e) {
    console.warn(`⚠️ Failed to fetch ${key}, returning null.`, e.message);
    return null;
  }
}

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
  // 🔒 Prevent concurrent calls
  if (isConnecting) {
    console.warn("⏳ Connection already in progress. Please wait.");
    return;
  }
  isConnecting = true;

  try {
    if (!window.ethereum) throw new Error("MetaMask not installed.");
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
    const accounts = await provider.send("eth_requestAccounts", []);
    if (!accounts || accounts.length === 0)
      throw new Error("No account selected.");

    signer = await provider.getSigner();
    userWalletAddress = await signer.getAddress();
    isWalletConnected = true;
    syncWalletToStorage(userWalletAddress);
    await initContract();
    updateWalletUI(userWalletAddress);
    showToast(
      "Wallet connected: " + truncateAddress(userWalletAddress),
      "success",
    );
    window.dispatchEvent(
      new CustomEvent("walletConnected", {
        detail: { address: userWalletAddress },
      }),
    );
    return userWalletAddress;
  } catch (error) {
    console.error("❌ Connect failed:", error);
    // If the error is "pending request", show a user-friendly message
    if (error.code === -32002) {
      showToast(
        "MetaMask is already waiting for your confirmation. Please check the MetaMask popup.",
        "warning",
      );
    } else {
      showToast(error.message || "Failed to connect wallet.", "error");
    }
    throw error;
  } finally {
    isConnecting = false;
  }
}

// ─── Sync wallet to localStorage (for auth.js) ──────────
function syncWalletToStorage(address) {
  if (address) {
    localStorage.setItem("traxenWallet", address);
  } else {
    localStorage.removeItem("traxenWallet");
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
function getWalletAddress() {
  return userWalletAddress;
}
function isConnected() {
  return userWalletAddress !== null && contractInstance !== null;
}

async function reconnectWeb3() {
  if (isConnected()) return true;
  if (userWalletAddress && !contractInstance) {
    try {
      await initContract();
      return true;
    } catch (e) {
      return false;
    }
  }
  if (!window.ethereum) return false;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts && accounts.length > 0) {
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      userWalletAddress = accounts[0];
      isWalletConnected = true;
      syncWalletToStorage(userWalletAddress);
      updateWalletUI(userWalletAddress);
      window.dispatchEvent(
        new CustomEvent("walletConnected", {
          detail: { address: userWalletAddress },
        }),
      );
      await initContract();
      return true;
    }
  } catch (e) {
    console.error("Reconnect failed:", e);
  }
  return false;
}
window.reconnectWeb3 = reconnectWeb3;

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

/* ============================================================
   READ FUNCTIONS (with retry + cache)
   ============================================================ */

/** Get full agreement details (all fields) */
async function getAgreement(agreementId) {
  return withCache('agreement', [agreementId], async () => {
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
  });
}

/** Get escrow balance (remaining) */
async function getEscrowBalance(agreementId) {
  return withCache('balance', [agreementId], async () => {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const balance = await contract.getEscrowBalance(agreementId);
    return { wei: balance.toString(), eth: ethers.formatEther(balance) };
  });
}

/** Get milestone details */
async function getMilestone(agreementId, milestoneId) {
  return withCache('milestone', [agreementId, milestoneId], async () => {
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
  });
}

/* ============================================================
   WRITE FUNCTIONS (no cache, no retry – user signs)
   ============================================================ */

async function createAgreement(
  carrierAddress,
  escrowAmount,
  deadline,
  milestoneDescriptions,
  paymentPercentages,
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
      paymentPercentages,
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

/* ============================================================
   ADDITIONAL QUERY FUNCTIONS (with retry, no cache)
   ============================================================ */

async function getAgreementsByShipper(shipperAddress) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const count = Number(await contract.getAgreementCount());
    const agreements = [];
    const shipperLower = shipperAddress.toLowerCase();

    for (let i = 1; i <= count; i++) {
      try {
        const ag = await fetchWithRetry(() => contract.getAgreement(i), 2, 300);
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
        console.warn(`Skipping agreement ${i}:`, innerErr.message);
      }
    }
    return agreements;
  } catch (error) {
    console.error("❌ Failed to get agreements by shipper:", error);
    return [];
  }
}
window.getAgreementsByShipper = getAgreementsByShipper;

async function getCarriersFromAgreements() {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const count = Number(await contract.getAgreementCount());
    const carrierSet = new Set();

    for (let i = 1; i <= count; i++) {
      try {
        const ag = await fetchWithRetry(() => contract.getAgreement(i), 2, 300);
        carrierSet.add(ag.carrier.toLowerCase());
      } catch (innerErr) {
        console.warn(`Skipping agreement ${i}:`, innerErr.message);
      }
    }
    return Array.from(carrierSet);
  } catch (error) {
    console.error("❌ Failed to get carriers from agreements:", error);
    return [];
  }
}
window.getCarriersFromAgreements = getCarriersFromAgreements;

async function getAgreementsByWallet(walletAddress) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const count = Number(await contract.getAgreementCount());
    const agreements = [];
    const targetLower = walletAddress.toLowerCase();

    for (let i = 1; i <= count; i++) {
      try {
        const ag = await fetchWithRetry(() => contract.getAgreement(i), 2, 300);
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
    return [];
  }
}
window.getAgreementsByWallet = getAgreementsByWallet;

async function getPendingAgreementsForCarrier(carrierAddress) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const count = Number(await contract.getAgreementCount());
    const pending = [];
    const carrierLower = carrierAddress.toLowerCase();

    for (let i = 1; i <= count; i++) {
      try {
        const ag = await fetchWithRetry(() => contract.getAgreement(i), 2, 300);
        const carrier = ag.carrier.toLowerCase();
        const status = Number(ag.status);
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
    return [];
  }
}
window.getPendingAgreementsForCarrier = getPendingAgreementsForCarrier;

async function getAllCarriers() {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();

    const totalUsers = Number(await contract.getTotalRegisteredUsers());
    const carriers = [];

    for (let i = 0; i < totalUsers; i++) {
      try {
        const address = await contract.getRegisteredUser(i);
        const role = Number(await contract.getRole(address));
        if (role === 2) {
          carriers.push(address);
        }
      } catch (innerErr) {
        console.warn(`Skipping user ${i}:`, innerErr.message);
      }
    }
    return carriers;
  } catch (error) {
    console.error("Failed to get all carriers:", error);
    return [];
  }
}
window.getAllCarriers = getAllCarriers;

/* ============================================================
   WALLET UI & LISTENERS
   ============================================================ */

function updateWalletUI(address) {
  const els = document.querySelectorAll(
    ".wallet-addr, .wallet-chip, .connect-wallet-btn",
  );
  els.forEach((el) => {
    if (address) {
      el.classList.remove("disconnected");
      el.classList.add("connected");
      if (el.classList.contains("wallet-addr"))
        el.textContent = truncateAddress(address);
    } else {
      el.classList.remove("connected");
      el.classList.add("disconnected");
    }
  });
  document.querySelectorAll("[data-wallet-address]").forEach((e) => {
    e.textContent = address ? truncateAddress(address) : "Not connected";
  });
}

function truncateAddress(address) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return (
    address.substring(0, 6) + "..." + address.substring(address.length - 4)
  );
}

function setupListeners() {
  if (!window.ethereum) return;

  window.ethereum.on("accountsChanged", async (accounts) => {
    console.log("🔄 Account changed:", accounts);

    if (accounts.length === 0) {
      if (typeof window.Auth?.clearAuthData === "function") {
        window.Auth.clearAuthData();
      }
      userWalletAddress = null;
      signer = null;
      contractInstance = null;
      isWalletConnected = false;
      syncWalletToStorage(null);
      updateWalletUI(null);
      const current = window.location.pathname;
      if (!["/login", "/register", "/"].includes(current)) {
        window.location.href = "/login";
      }
      return;
    }

    const newAddress = accounts[0];
    if (
      userWalletAddress &&
      newAddress.toLowerCase() === userWalletAddress.toLowerCase()
    ) {
      console.log("Same account, ignoring.");
      return;
    }

    console.log("New account detected – clearing session.");
    if (typeof window.Auth?.clearAuthData === "function") {
      window.Auth.clearAuthData();
    }
    userWalletAddress = null;
    signer = null;
    contractInstance = null;
    isWalletConnected = false;
    syncWalletToStorage(null);
    updateWalletUI(null);
    if (!["/login", "/register", "/"].includes(window.location.pathname)) {
      window.location.href = "/login";
    }
  });

  window.ethereum.on("chainChanged", () => {
    console.log("⛓️ Network changed – reloading.");
    if (typeof window.Auth?.clearAuthData === "function") {
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
  const isPublic =
    ["/", "/login", "/register"].includes(currentPath) ||
    currentPath.startsWith("/login") ||
    currentPath.startsWith("/register");

  if (isPublic) {
    console.log("Public page – no auto-connect.");
    return;
  }

  const accounts = await window.ethereum.request({ method: "eth_accounts" });
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
      if (typeof window.Auth?.clearAuthData === "function") {
        window.Auth.clearAuthData();
      }
      syncWalletToStorage(null);
      if (!isPublic) window.location.href = "/login";
    }
  } else {
    console.log("No account – redirect to login.");
    if (!isPublic) window.location.href = "/login";
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
  console.log(`[${type}] ${msg}`);
}

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
window.acceptAgreementOnChain = acceptAgreement;
window.rejectAgreementOnChain = rejectAgreement;
window.cancelAgreement = cancelAgreement;
window.getMilestone = getMilestone;
window.submitMilestone = submitMilestone;
window.verifyMilestone = verifyMilestone;
window.releasePayment = releasePayment;
window.getEscrowBalance = getEscrowBalance;
window.roleNumberToName = roleNumberToName;
window.agreementStatusToName = agreementStatusToName;
window.milestoneStatusToName = milestoneStatusToName;
window.paymentStatusToName = paymentStatusToName;
window.markExpired = markExpired;
window.refund = refund;
window.getAgreementsByShipper = getAgreementsByShipper;
window.getCarriersFromAgreements = getCarriersFromAgreements;
window.getAgreementsByWallet = getAgreementsByWallet;
window.getPendingAgreementsForCarrier = getPendingAgreementsForCarrier;
window.getAllCarriers = getAllCarriers;

window.isInitializing = isInitializing;

/* ============================================================
   START WEB3
   ============================================================ */

document.addEventListener("DOMContentLoaded", initializeWeb3);
window.__CONFIG = CONFIG;
window.__loadContractABI = loadContractABI;