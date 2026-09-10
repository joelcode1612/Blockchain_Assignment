// ═══ YON — REPUTATION MODULE ═══
// Reads the carrier reputation token (REP, ERC-20 style) from the
// LogisticsEscrow smart contract on Sepolia.
const { ethers } = require('ethers');
const artifact = require('../../abi/LogisticsEscrow.json');

/// Fix : use the one shared RPC config module, and require it
/// before reading LOGISTICS_ESCROW_ADDRESS. Previously this used the removed
/// process.env.RPC_URL (with a stale ankr fallback), and the contract address
/// could be undefined when dotenv had not been loaded yet.
const { RPC_URLS } = require('../config/index');

const abi = artifact.abi || artifact;
const contractAddress = process.env.LOGISTICS_ESCROW_ADDRESS;
/// Fix end

async function getWorkingProvider() {
  for (const url of RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      return provider;
    } catch (error) {
      console.warn(`⚠️ [Yon/reputation] Failed to connect to ${url}:`, error.message);
    }
  }
  throw new Error('All RPC providers failed');
}

async function getContract() {
  const provider = await getWorkingProvider();
  return new ethers.Contract(contractAddress, abi, provider);
}

const getTokenInfo = async () => {
  const contract = await getContract();
  const [name, symbol, decimals, totalSupplyRaw] = await Promise.all([
    contract.reputationTokenName(),
    contract.reputationTokenSymbol(),
    contract.reputationTokenDecimals(),
    contract.reputationTokenTotalSupply(),
  ]);
  return {
    name,
    symbol,
    decimals: Number(decimals),
    totalSupplyRaw: totalSupplyRaw.toString(),
  };
};

const getBalance = async (wallet) => {
  const contract = await getContract();
  const raw = await contract.balanceOf(wallet);
  return raw.toString();
};

module.exports = { getTokenInfo, getBalance };
// ═══ YON End ═══
