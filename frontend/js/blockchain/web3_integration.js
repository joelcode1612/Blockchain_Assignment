/**
 * web3_integration.js - MetaMask & Smart Contract Integration
 * Handles wallet connection, contract initialization, and blockchain interactions
 */

// ─── Configuration ──────────────────────────────────────────
const CONFIG = {
    // 🔥 UPDATE THIS WITH YOUR DEPLOYED CONTRACT ADDRESS
    contractAddress: '0xa5F99226D5E756D1e3a2490f83460AF576F05D8B', // Sepolia
    // contractAddress: '0x27839E697d52e37CB8ae317F5017F3523DB10d57', // Local Ganache
};

// ─── State ──────────────────────────────────────────────────
let userWalletAddress = null;
let contractInstance = null;
let isWalletConnected = false;

// ─── ABI Loading ────────────────────────────────────────────
async function loadContractABI() {
    try {
        const response = await fetch('/abi/LogisticsEscrowABI.json');
        if (response.ok) {
            const data = await response.json();
            // If it has an 'abi' property, extract it
            if (data && data.abi && Array.isArray(data.abi)) {
                return data.abi;
            }
            // If it's already an array, return as is
            if (Array.isArray(data)) {
                return data;
            }
            console.warn('Invalid ABI format, using minimal ABI.');
            return getMinimalABI();
        }
        console.warn('ABI file not found, using minimal ABI.');
        return getMinimalABI();
    } catch (error) {
        console.error('Failed to load ABI:', error);
        return getMinimalABI();
    }
}

// ─── Minimal ABI (with agreementCounter added) ────────────
function getMinimalABI() {
    return [
        // ✅ Added agreementCounter so we can get the next agreement ID
        { inputs: [], name: 'agreementCounter', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
        // ─── Core functions ──────────────────────────────
        { inputs: [{ internalType: 'uint256', name: '_agreementId', type: 'uint256' }], name: 'getEscrowBalance', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
        { inputs: [{ internalType: 'uint256', name: '_agreementId', type: 'uint256' }], name: 'depositEscrow', outputs: [], stateMutability: 'payable', type: 'function' },
        { inputs: [{ internalType: 'uint256', name: '_agreementId', type: 'uint256' }, { internalType: 'uint256', name: '_milestoneId', type: 'uint256' }], name: 'verifyMilestone', outputs: [], stateMutability: 'nonpayable', type: 'function' },
        { inputs: [{ internalType: 'uint256', name: '_agreementId', type: 'uint256' }, { internalType: 'uint256', name: '_milestoneId', type: 'uint256' }], name: 'releasePayment', outputs: [], stateMutability: 'nonpayable', type: 'function' },
        { inputs: [{ internalType: 'uint256', name: '_agreementId', type: 'uint256' }], name: 'refund', outputs: [], stateMutability: 'nonpayable', type: 'function' }
    ];
}

// ─── Connect Wallet ─────────────────────────────────────────
async function connectWallet() {
    console.log('🔗 connectWallet called');
    if (!window.ethereum) {
        showToast('Please install MetaMask! 🦊', 'error');
        return false;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userWalletAddress = accounts[0];
        window.userWalletAddress = userWalletAddress;
        isWalletConnected = true;

        console.log('✅ Wallet connected:', userWalletAddress);
        updateWalletUI(userWalletAddress);
        showToast(`Wallet connected: ${truncateAddress(userWalletAddress)}`, 'success');

        await initContract();
        window.dispatchEvent(new CustomEvent('walletConnected', { detail: { address: userWalletAddress } }));
        return true;
    } catch (error) {
        console.error('❌ Connection error:', error);
        if (error.code === 4001) {
            showToast('User rejected connection request.', 'error');
        } else {
            showToast('Failed to connect wallet: ' + error.message, 'error');
        }
        return false;
    }
}

// ─── Initialize Contract ────────────────────────────────────
async function initContract() {
    if (!window.ethereum || !userWalletAddress) {
        console.warn('Cannot initialize contract: No wallet connected.');
        return null;
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const abi = await loadContractABI();

        if (!abi || abi.length === 0) {
            showToast('Failed to load contract ABI.', 'error');
            return null;
        }

        contractInstance = new ethers.Contract(CONFIG.contractAddress, abi, signer);
        window.contract = contractInstance;
        console.log('✅ Contract initialized at:', CONFIG.contractAddress);
        return contractInstance;
    } catch (error) {
        console.error('Failed to initialize contract:', error);
        showToast('Failed to connect to smart contract.', 'error');
        return null;
    }
}

// ─── UI Updates ─────────────────────────────────────────────
function updateWalletUI(address) {
    const walletChips = document.querySelectorAll('.wallet-chip, .connect-wallet-btn');
    walletChips.forEach(el => {
        if (address) {
            el.classList.remove('disconnected');
            el.classList.add('connected');
            const addrSpan = el.querySelector('.wallet-addr');
            if (addrSpan) {
                addrSpan.textContent = truncateAddress(address);
            }
            if (el.tagName === 'BUTTON' || el.classList.contains('connect-wallet-btn')) {
                el.innerHTML = `🟢 ${truncateAddress(address)}`;
            }
        } else {
            el.classList.remove('connected');
            el.classList.add('disconnected');
            if (el.tagName === 'BUTTON' || el.classList.contains('connect-wallet-btn')) {
                el.textContent = '🔗 Connect Wallet';
            }
        }
    });
}

// ─── Helpers ────────────────────────────────────────────────
function truncateAddress(address) {
    if (!address) return '';
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getWalletAddress() {
    return userWalletAddress;
}

function getContract() {
    return contractInstance;
}

function isConnected() {
    return !!userWalletAddress && isWalletConnected;
}

// ─── MetaMask Event Listeners ──────────────────────────────
function setupWalletListeners() {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', async (accounts) => {
        console.log('🔄 Accounts changed:', accounts);
        if (accounts.length > 0) {
            userWalletAddress = accounts[0];
            window.userWalletAddress = userWalletAddress;
            updateWalletUI(userWalletAddress);
            showToast(`Account changed to: ${truncateAddress(userWalletAddress)}`, 'info');
            await initContract();
            if (window.refreshData) window.refreshData();
        } else {
            userWalletAddress = null;
            isWalletConnected = false;
            updateWalletUI(null);
            showToast('Wallet disconnected.', 'info');
        }
    });

    window.ethereum.on('chainChanged', () => {
        console.log('⛓️ Chain changed, reloading...');
        window.location.reload();
    });
}

// ─── Auto‑init on page load ────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    setupWalletListeners();

    if (window.ethereum && window.ethereum.selectedAddress) {
        userWalletAddress = window.ethereum.selectedAddress;
        window.userWalletAddress = userWalletAddress;
        isWalletConnected = true;
        updateWalletUI(userWalletAddress);
        await initContract();
        // ✅ Dispatch the event so the UI refreshes
        window.dispatchEvent(new CustomEvent('walletConnected', { detail: { address: userWalletAddress } }));
    }

    document.querySelectorAll('.connect-wallet-btn').forEach(btn => {
        btn.removeEventListener('click', connectWallet);
        btn.addEventListener('click', connectWallet);
    });
});

// ─── Expose Globally ────────────────────────────────────────
window.connectWallet = connectWallet;
window.initContract = initContract;
window.getWalletAddress = getWalletAddress;
window.getContract = getContract;
window.isConnected = isConnected;
window.truncateAddress = truncateAddress;
window.userWalletAddress = userWalletAddress;

window.addEventListener('walletConnected', (e) => {
    console.log('📢 walletConnected event received:', e.detail);
});