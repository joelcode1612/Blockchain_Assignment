const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  networks: {
    // ganache: {
    //   host: "127.0.0.1",
    //   port: 9545,
    //   network_id: 5777,
    //   gas: 6721975,
    // },
    sepolia: {
      provider: () => {
        if (!PRIVATE_KEY) {
          throw new Error('PRIVATE_KEY not set in .env');
        }
        return new HDWalletProvider({
          privateKeys: [PRIVATE_KEY],
          providerOrUrl: 'https://ethereum-sepolia.publicnode.com'
          // providerOrUrl: 'https://sepolia.infura.io/v3/5fe029b3d6994109861751d4e9a7c32b',
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
    solc: {
      version: "0.8.24",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};