const { ethers } = require('ethers');
const artifact = require('../../abi/LogisticsEscrow.json');

const abi = artifact.abi || artifact;

const contractAddress = process.env.LOGISTICS_ESCROW_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;

const RPC_URLS = [
    process.env.RPC_URL,
    'https://ethereum-sepolia.publicnode.com',
    'https://rpc.ankr.com/eth_sepolia',
    'https://sepolia.gateway.tenderly.co',
].filter(Boolean);

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

// ─── Exported Functions ─────────────────────────────────────

const depositEscrow = async (agreementId, amount, shipperAddress) => {
    return writeContract('depositEscrow', agreementId, { value: amount, from: shipperAddress });
};

const getEscrowBalance = async (agreementId) => {
    return readContract('getEscrowBalance', agreementId);
};

const releasePayment = async (agreementId, milestoneId) => {
    return writeContract('releasePayment', agreementId, milestoneId);
};

const verifyMilestone = async (agreementId, milestoneId, shipperAddress) => {
    return writeContract('verifyMilestone', agreementId, milestoneId, { from: shipperAddress });
};

const isPaymentReleased = async (agreementId, milestoneId) => {
    return readContract('getMilestone', agreementId, milestoneId).then(m => m[3]);
};

const getAgreementCounter = async () => {
    return readContract('agreementCounter');
};

// ✅ ADDED: used by paymentController.calculatePayment()
const getMilestone = async (agreementId, milestoneId) => {
    return readContract('getMilestone', agreementId, milestoneId);
};

module.exports = {
    depositEscrow,
    getEscrowBalance,
    releasePayment,
    verifyMilestone,
    isPaymentReleased,
    getAgreementCounter,
    getMilestone,   // 👈 Added
};