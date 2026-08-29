const { ethers } = require('ethers');
const path = require('path');
const artifact = require(path.resolve(__dirname, '../../abi/LogisticsEscrow.json'));
const { RPC_URLS }  = require(path.resolve(__dirname, '../config/index'));


const abi = artifact.abi || artifact;

const contractAddress = process.env.LOGISTICS_ESCROW_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;

console.log('🔍 [backend] Using RPCs:', RPC_URLS);

async function getWorkingProvider() {
    for (const url of RPC_URLS) {
        try {
            const provider = new ethers.JsonRpcProvider(url);
            await provider.getBlockNumber();
            console.log(`✅ Connected to ${url}`);
            return provider;
        } catch (error) {
            console.warn(`⚠️ Failed to connect to ${url}:`, error.message);
        }
    }
    throw new Error('All RPC providers failed');
}

const wallet = new ethers.Wallet(privateKey);

async function getContract(providerOrSigner) {
    return new ethers.Contract(contractAddress, abi, providerOrSigner);
}

async function readContract(method, ...args) {
    console.log(`📖 [readContract] Calling ${method}...`);
    const provider = await getWorkingProvider();
    const contract = await getContract(provider);
    const result = await contract[method](...args);
    console.log(`✅ ${method} returned:`, typeof result === 'object' ? '✅' : result);
    return result;
}

async function writeContract(method, ...args) {
    console.log(`✍️ [writeContract] Calling ${method}...`);
    const provider = await getWorkingProvider();
    const signer = wallet.connect(provider);
    const contract = await getContract(signer);
    const tx = await contract[method](...args);
    console.log(`📨 Tx hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ ${method} confirmed in block ${receipt.blockNumber}`);
    return receipt;
}

// ─── READ FUNCTIONS ─────────────────────────────────────────

/** Get full agreement details (all fields) */
const getAgreement = async (agreementId) => {
    return readContract('getAgreement', agreementId);
};

/** Get escrow balance (remaining) */
const getEscrowBalance = async (agreementId) => {
    return readContract('getEscrowBalance', agreementId);
};

/** Get milestone details */
const getMilestone = async (agreementId, milestoneId) => {
    return readContract('getMilestone', agreementId, milestoneId);
};

/** Get number of milestones in an agreement */
const getMilestoneCount = async (agreementId) => {
    return readContract('getMilestoneCount', agreementId);
};

/** Get total amount released so far */
const getReleasedAmount = async (agreementId) => {
    return readContract('getReleasedAmount', agreementId);
};

/** Get agreement counter (total agreements created) */
const getAgreementCounter = async () => {
    return readContract('agreementCounter');
};

/** Check if a wallet is registered */
const isRegistered = async (walletAddress) => {
    return readContract('isRegistered', walletAddress);
};

/** Get role of a wallet (0=None, 1=Shipper, 2=Carrier) */
const getRole = async (walletAddress) => {
    return readContract('getRole', walletAddress);
};

/** Check if a milestone payment has been released (alias) */
const isPaymentReleased = async (agreementId, milestoneId) => {
    const m = await getMilestone(agreementId, milestoneId);
    return m[2] === 3; // status === Paid (3)
};

// ─── WRITE FUNCTIONS (server-signed) ───────────────────────

/** Deposit escrow (server‑side, if needed) */
const depositEscrow = async (agreementId, amount, shipperAddress) => {
    return writeContract('depositEscrow', agreementId, { value: amount, from: shipperAddress });
};

/** Release payment (server‑side, e.g., auto‑release) */
const releasePayment = async (agreementId, milestoneId) => {
    return writeContract('releasePayment', agreementId, milestoneId);
};

/** Verify milestone (server‑side, if needed) */
const verifyMilestone = async (agreementId, milestoneId, shipperAddress) => {
    return writeContract('verifyMilestone', agreementId, milestoneId, { from: shipperAddress });
};

/** Refund escrow (server‑side, e.g., after deadline) */
const refund = async (agreementId) => {
    return writeContract('refund', agreementId);
};

/** Create agreement (server‑side, if needed) */
const createAgreement = async (carrier, totalAmount, deadline, descriptions, percentages, shipperAddress) => {
    return writeContract('createAgreement', carrier, totalAmount, deadline, descriptions, percentages, { from: shipperAddress });
};

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    // Reads
    getAgreement,
    getEscrowBalance,
    getMilestone,
    getMilestoneCount,
    getReleasedAmount,
    getAgreementCounter,
    isRegistered,
    getRole,
    isPaymentReleased,

    // Writes
    depositEscrow,
    releasePayment,
    verifyMilestone,
    refund,
    createAgreement,
};