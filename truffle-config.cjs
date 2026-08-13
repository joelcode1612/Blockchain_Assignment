const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  networks: {
    sepolia: {
      provider: () => {
        if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set');
        return new HDWalletProvider({
          privateKeys: [PRIVATE_KEY],
          providerOrUrl: 'https://ethereum-sepolia.publicnode.com',
        });
      },
      network_id: 11155111,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },
  compilers: {
    solc: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } }
  }
};