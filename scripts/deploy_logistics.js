#!/usr/bin/env node
/**
 * Fresh-deploy LogisticsEscrow to the configured network.
 *
 * Why this exists:
 *   1. The checked-in artifacts in abi/ and build/ were STALE — their bytecode
 *      predates the reputation module, so deploying from them would have
 *      deployed the old contract again.
 *   2. The contract address was hardcoded in four separate files, which drift
 *      apart after every redeploy.
 *
 * This script recompiles from source, deploys, rewrites both artifacts with
 * current bytecode + the new network address, then syncs the address into
 * every place that hardcodes it.
 *
 * Usage:
 *   node scripts/deploy_logistics.js
 *   node scripts/deploy_logistics.js --no-address-update
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTRACT_FILE = path.join(ROOT, 'contracts', 'LogisticsEscrow.sol');
const CONTRACT_SOURCE_NAME = 'LogisticsEscrow.sol';
const CONTRACT_NAME = 'LogisticsEscrow';
const EXPECTED_SOLC = '0.8.24';

const solc = require(path.join(ROOT, 'node_modules', 'solc'));
require(path.join(ROOT, 'node_modules', 'dotenv')).config({
  path: path.join(ROOT, '.env'),
});
const { ethers } = require(path.join(ROOT, 'node_modules', 'ethers'));
// Single source of RPC endpoints — the same module the backend uses.
const { RPC_URLS } = require(path.join(ROOT, 'backend', 'config', 'index'));

const ARTIFACT_FILES = [
  path.join(ROOT, 'abi', 'LogisticsEscrow.json'),
  path.join(ROOT, 'build', 'contracts', 'LogisticsEscrow.json'),
];

const ADDRESS_TARGETS = [
  { file: path.join(ROOT, '.env'), kind: 'env' },
  {
    file: path.join(ROOT, 'frontend', 'js', 'blockchain', 'web3_integration.js'),
    kind: 'js',
  },
  {
    file: path.join(ROOT, 'frontend', 'js', 'shared', 'session.js'),
    kind: 'js',
  },
  {
    file: path.join(ROOT, 'frontend', 'js', 'blockchain', 'no_replaced.js'),
    kind: 'js',
  },
];

const UPDATE_ADDRESSES = !process.argv.includes('--no-address-update');

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

/* ---------------------------------------------------------------- compile */

function compileContract() {
  const source = fs.readFileSync(CONTRACT_FILE, 'utf8');

  const input = {
    language: 'Solidity',
    sources: { [CONTRACT_SOURCE_NAME]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const diagnostics = output.errors || [];
  const errors = diagnostics.filter((e) => e.severity === 'error');
  const warnings = diagnostics.filter((e) => e.severity === 'warning');

  warnings.forEach((w) =>
    console.warn('  [warn] ' + w.formattedMessage.split('\n')[0]),
  );

  if (errors.length > 0) {
    errors.forEach((e) => console.error('  [error] ' + e.formattedMessage));
    throw new Error(
      `Compilation failed with ${errors.length} error(s) — nothing was deployed.`,
    );
  }

  const contract = output.contracts[CONTRACT_SOURCE_NAME][CONTRACT_NAME];
  if (!contract || !contract.evm.bytecode.object) {
    throw new Error(`No bytecode produced for ${CONTRACT_NAME}.`);
  }

  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
    deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
  };
}

/* --------------------------------------------------------------- provider */

async function connectProvider() {
  for (const url of RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      log('rpc', `connected via ${url}`);
      return provider;
    } catch (error) {
      log('rpc', `failed ${url} :: ${error.message}`);
    }
  }
  throw new Error('No working RPC endpoint available.');
}

/* --------------------------------------------------------------- artifacts */

function writeArtifacts({ abi, bytecode, deployedBytecode, address, chainId, txHash, blockNumber, source }) {
  for (const file of ARTIFACT_FILES) {
    let artifact = {};
    if (fs.existsSync(file)) {
      try {
        artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        log('artifact', `could not parse ${file}, starting fresh (${error.message})`);
        artifact = {};
      }
    }

    const sizeBefore = fs.existsSync(file) ? fs.statSync(file).size : 0;

    artifact.contractName = CONTRACT_NAME;
    artifact.abi = abi;
    artifact.bytecode = bytecode;
    artifact.deployedBytecode = deployedBytecode;
    if ('source' in artifact) artifact.source = source;
    artifact.updatedAt = new Date().toISOString();

    artifact.networks = artifact.networks || {};
    artifact.networks[String(chainId)] = {
      address,
      transactionHash: txHash,
      blockNumber,
      deployedAt: new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(artifact, null, 2));

    const sizeAfter = fs.statSync(file).size;
    log(
      'artifact',
      `${path.relative(ROOT, file)} updated (${(sizeBefore / 1024).toFixed(0)}KB -> ${(sizeAfter / 1024).toFixed(0)}KB)`,
    );
  }
}

/* -------------------------------------------------------- address syncing */

// /// Fix : keeps every hardcoded copy of the contract address in
// //  sync after a redeploy. Previously this was a manual 4-file edit and any
// //  missed file silently pointed the app at the old contract.
function syncAddresses(newAddress) {
  const results = [];

  for (const target of ADDRESS_TARGETS) {
    if (!fs.existsSync(target.file)) {
      results.push({ file: path.relative(ROOT, target.file), status: 'missing' });
      continue;
    }

    const original = fs.readFileSync(target.file, 'utf8');
    let updated = original;

    if (target.kind === 'env') {
      updated = original.replace(
        /^LOGISTICS_ESCROW_ADDRESS=.*$/m,
        `LOGISTICS_ESCROW_ADDRESS=${newAddress}`,
      );
    } else {
      updated = original.replace(
        /(contractAddress:\s*["'])(0x[0-9a-fA-F]{40})(["'])/,
        `$1${newAddress}$3`,
      );
    }

    if (updated === original) {
      results.push({
        file: path.relative(ROOT, target.file),
        status: 'no match (already current or pattern changed)',
      });
    } else {
      fs.writeFileSync(target.file, updated);
      results.push({ file: path.relative(ROOT, target.file), status: 'updated' });
    }
  }

  return results;
}
// /// Fix end

/* ------------------------------------------------------------------- main */

async function main() {
  console.log('=== LogisticsEscrow fresh deployment ===\n');

  if (solc.version().split('+')[0] !== EXPECTED_SOLC) {
    throw new Error(
      `Expected solc ${EXPECTED_SOLC} but found ${solc.version()}. Refusing to deploy with a different compiler.`,
    );
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set in .env — cannot deploy.');
  }

  log('compile', `solc ${solc.version().split('+')[0]} with optimizer runs=200`);
  const { abi, bytecode, deployedBytecode } = compileContract();
  const source = fs.readFileSync(CONTRACT_FILE, 'utf8');
  const functionNames = abi.filter((x) => x.type === 'function').map((x) => x.name);
  const hasReputation = [
    'balanceOf',
    'reputationTokenSymbol',
    'reputationTokenTotalSupply',
    'registerUser',
  ].every((n) => functionNames.includes(n));

  log('compile', `abi entries=${abi.length} bytecode=${bytecode.length} chars`);
  log(
    'compile',
    hasReputation
      ? 'reputation module present ✓'
      : 'WARNING: reputation module functions not found in ABI',
  );

  const provider = await connectProvider();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);

  log('wallet', `deployer=${wallet.address}`);
  log('wallet', `chainId=${chainId} balance=${ethers.formatEther(balance)} ETH`);

  const previousAddress = process.env.LOGISTICS_ESCROW_ADDRESS || null;
  if (previousAddress) {
    const previousBalance = await provider.getBalance(previousAddress).catch(() => 0n);
    const previousCode = await provider.getCode(previousAddress).catch(() => '0x');
    if (previousCode !== '0x') {
      log(
        'orphan',
        `previous contract ${previousAddress} keeps ${ethers.formatEther(previousBalance)} ETH locked and is now abandoned`,
      );
    }
  }

  log('deploy', 'sending deployment transaction...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  const deploymentTx = contract.deploymentTransaction();
  log('deploy', `tx hash=${deploymentTx.hash}`);
  log('deploy', 'waiting for confirmation...');

  const receipt = await deploymentTx.wait();
  const address = await contract.getAddress();
  const code = await provider.getCode(address);

  if (code === '0x') {
    throw new Error(`Deployment transaction mined but no code at ${address}.`);
  }

  log('deploy', `confirmed in block ${receipt.blockNumber}`);
  log('deploy', `gas used=${receipt.gasUsed.toString()}`);
  log('deploy', `NEW CONTRACT ADDRESS = ${address}`);

  writeArtifacts({
    abi,
    bytecode,
    deployedBytecode,
    address,
    chainId,
    txHash: deploymentTx.hash,
    blockNumber: receipt.blockNumber,
    source,
  });

  if (UPDATE_ADDRESSES) {
    const results = syncAddresses(address);
    for (const r of results) log('address', `${r.file} :: ${r.status}`);
  } else {
    log('address', 'skipped (--no-address-update)');
  }

  console.log('\n=== next steps ===');
  console.log(`1. Restart the backend so .env is re-read.`);
  console.log(
    `2. Old contract ${previousAddress || '(none)'} is abandoned — its data is intact on-chain but unused.`,
  );
  console.log('3. Re-register users on the new contract so carriers get their 100 REP.');
  if (previousAddress && previousAddress !== address) {
    console.log(
      '4. The database still references the old onchain_ids — reset it if you want a clean slate.',
    );
  }
}

main().catch((error) => {
  console.error('\nDEPLOYMENT FAILED:', error.message);
  process.exit(1);
});
