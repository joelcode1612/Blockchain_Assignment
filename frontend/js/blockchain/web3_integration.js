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
 * - Ganache
 * - Truffle
 * - LogisticsEscrow.sol
 *
 * ============================================================
 */

/* ============================================================
   CONFIGURATION
   ============================================================ */

const CONFIG = {
  contractAddress: "0x14a58F6FFAa80BE8317aB48acd30Fd37f27978F0",
  ganacheChainId: 11155111,
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

/* ============================================================
   LOAD TRUFFLE ABI
   ============================================================ */

async function loadContractABI() {
  try {
    const response = await fetch(CONFIG.abiPath);
    if (!response.ok) {
      throw new Error("Unable to load LogisticsEscrow ABI.");
    }
    const artifact = await response.json();

    if (!artifact.abi || !Array.isArray(artifact.abi)) {
      throw new Error("Invalid Truffle ABI format.");
    }

    console.log("✅ LogisticsEscrow ABI loaded.");
    return artifact.abi;
  } catch (error) {
    console.error("❌ Failed to load ABI:", error);
    throw error;
  }
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
   CHECK GANACHE NETWORK
   ============================================================ */

async function checkGanacheNetwork() {
  const network = await getNetwork();
  const chainId = Number(network.chainId);
  console.log("🌐 Current Chain ID:", chainId);

  if (chainId !== CONFIG.ganacheChainId) {
    throw new Error(
      "Wrong network. Please switch MetaMask to Ganache (Chain ID: " +
        CONFIG.ganacheChainId +
        ").",
    );
  }
  return true;
}

/* ============================================================
   CONNECT METAMASK
   ============================================================ */

async function connectWallet() {
  try {
    checkMetaMask();
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
    const accounts = await provider.send("eth_requestAccounts", []);

    if (!accounts || accounts.length === 0) {
      throw new Error("No MetaMask account selected.");
    }

    signer = await provider.getSigner();
    userWalletAddress = await signer.getAddress();
    isWalletConnected = true;

    console.log("✅ MetaMask connected:", userWalletAddress);
    await checkGanacheNetwork();
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
    console.error("❌ Wallet connection failed:", error);
    handleBlockchainError(error, "Wallet connection failed.");
    throw error;
  }
}

/* ============================================================
   INITIALIZE SMART CONTRACT
   ============================================================ */

async function initContract() {
  try {
    if (!provider) {
      provider = new ethers.BrowserProvider(window.ethereum);
    }
    if (!signer) {
      signer = await provider.getSigner();
    }
    const abi = await loadContractABI();
    contractInstance = new ethers.Contract(CONFIG.contractAddress, abi, signer);
    window.contract = contractInstance;

    console.log("✅ LogisticsEscrow initialized.");
    console.log("📍 Contract:", CONFIG.contractAddress);
    return contractInstance;
  } catch (error) {
    console.error("❌ Contract initialization failed:", error);
    throw error;
  }
}

/* ============================================================
   GETTERS
   ============================================================ */

function getContract() {
  if (!contractInstance) throw new Error("Smart contract is not initialized.");
  return contractInstance;
}

function getWalletAddress() {
  return userWalletAddress;
}

function isConnected() {
  return (
    isWalletConnected && userWalletAddress !== null && contractInstance !== null
  );
}

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

    // FIXED: Only passing roleNumber. Strings belong in Supabase!
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
   AGREEMENT MODULE
   ============================================================ */

async function createAgreement(
  carrierAddress,
  escrowAmount,
  deadline,
  paymentPercentages,
) {
  try {
    if (!isConnected()) await connectWallet();
    const contract = getContract();
    const escrowWei = ethers.parseEther(String(escrowAmount));

    // FIXED: Removed milestoneDescriptions to match gas-optimized contract
    const transaction = await contract.createAgreement(
      carrierAddress,
      escrowWei,
      deadline,
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
   WALLET UI & LISTENERS
   ============================================================ */

function updateWalletUI(address) {
  const walletElements = document.querySelectorAll(
    ".wallet-chip, .connect-wallet-btn, .wallet-addr",
  );
  walletElements.forEach((element) => {
    if (address) {
      element.classList.remove("disconnected");
      element.classList.add("connected");
      const addressElement = element.querySelector(".wallet-addr");
      if (addressElement) addressElement.textContent = truncateAddress(address);
    } else {
      element.classList.remove("connected");
      element.classList.add("disconnected");
    }
  });

  document.querySelectorAll("[data-wallet-address]").forEach((element) => {
    element.textContent = address ? truncateAddress(address) : "Not connected";
  });
}

function truncateAddress(address) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return (
    address.substring(0, 6) + "..." + address.substring(address.length - 4)
  );
}

function setupWalletListeners() {
  if (!window.ethereum) return;
  window.ethereum.on("accountsChanged", async (accounts) => {
    console.log("🔄 MetaMask account changed:", accounts);
    if (accounts.length === 0) {
      userWalletAddress = null;
      signer = null;
      contractInstance = null;
      isWalletConnected = false;
      updateWalletUI(null);
      window.dispatchEvent(new CustomEvent("walletDisconnected"));
      return;
    }
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      userWalletAddress = await signer.getAddress();
      isWalletConnected = true;
      await checkGanacheNetwork();
      await initContract();
      updateWalletUI(userWalletAddress);
      window.dispatchEvent(
        new CustomEvent("walletConnected", {
          detail: { address: userWalletAddress },
        }),
      );
    } catch (error) {
      console.error("Account change error:", error);
    }
  });

  window.ethereum.on("chainChanged", async () => {
    console.log("⛓️ MetaMask network changed.");
    window.location.reload();
  });
}

async function initializeWeb3() {
  try {
    if (!window.ethereum) {
      console.warn("MetaMask not installed.");
      return;
    }
    setupWalletListeners();
    if (window.ethereum.selectedAddress) {
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      userWalletAddress = await signer.getAddress();
      isWalletConnected = true;
      try {
        await checkGanacheNetwork();
        await initContract();
        updateWalletUI(userWalletAddress);
        window.dispatchEvent(
          new CustomEvent("walletConnected", {
            detail: { address: userWalletAddress },
          }),
        );
      } catch (error) {
        console.error("Auto initialization failed:", error);
      }
    }
  } catch (error) {
    console.error("Web3 initialization failed:", error);
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

function showToast(message, type = "info") {
  if (
    typeof window.showToast === "function" &&
    window.showToast !== showToast
  ) {
    window.showToast(message, type);
    return;
  }
  console.log(`[${type.toUpperCase()}]`, message);
}

/* ============================================================
   GLOBAL FUNCTIONS
   ============================================================ */

// Keep window.userWalletAddress in sync with the internal state so
// agreement/deposit pages can send it as the x-wallet-address header.
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
window.checkGanacheNetwork = checkGanacheNetwork;
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
window.getEscrowBalance = getEscrowBalance;
window.truncateAddress = truncateAddress;
window.roleNumberToName = roleNumberToName;
window.agreementStatusToName = agreementStatusToName;
window.milestoneStatusToName = milestoneStatusToName;
window.paymentStatusToName = paymentStatusToName;

/* ============================================================
   START WEB3
   ============================================================ */
document.addEventListener("DOMContentLoaded", initializeWeb3);
