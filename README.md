# 🚚 Traxen — Decentralized Escrow Logistics Platform

A blockchain-based logistics escrow system built with **Solidity**, **Truffle**, **Node.js**, **Express**, **Supabase (PostgreSQL)**, and vanilla **JavaScript**.

Shippers create agreements, lock funds in a smart contract escrow, and release milestone payments to carriers. Every transaction is verifiable on-chain while off-chain metadata is stored in Supabase for fast queries.

## 📑 Table of Contents

1. [Architecture Overview](#-architecture-overview)
2. [Tech Stack](#-tech-stack)
3. [Project Structure](#-project-structure)
4. [Prerequisites](#-prerequisites)
5. [Environment Setup](#️-environment-setup)
6. [Smart Contract Deployment](#-smart-contract-deployment)
7. [Database Setup](#-database-setup)
8. [Backend Setup](#-backend-setup)
9. [Frontend Setup](#-frontend-setup)
10. [Verify the New Environment Works](#-verify-the-new-environment-works)
11. [Running the Full Stack](#-running-the-full-stack)
12. [Testing the Flow](#-testing-the-flow)
13. [Troubleshooting](#-troubleshooting)

## 🏗 Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND (Vanilla JS)                 │
│  · SPA router (shipper.js / carrier.js)                     │
│  · MetaMask for wallet connection (ethers.js v6)            │
│  · localStorage for caching                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
┌───────────────┐ ┌───────────┐ ┌───────────────────────────┐
│   SEPOLIA     │ │  BACKEND  │ │       SUPABASE            │
│  (on-chain)   │ │(Node.js)  │ │    (PostgreSQL)           │
│               │ │           │ │                           │
│ · Escrow      │ │ · Auth    │ │ · users                   │
│ · Milestones  │ │ · REST    │ │ · agreements              │
│ · Payments    │ │ · Syncs   │ │ · milestones              │
│ · Reputation  │ │   to DB   │ │ · escrow_history          │
└───────────────┘ └───────────┘ │ · payment_history         │
                                │ · refund_history          │
                                │ · reputation_history      │
                                └───────────────────────────┘
```

**Data flow:**

* **Reads** → Supabase (fast, cached) to reduce RPC calls.
* **Writes** → Blockchain first, then synced to Supabase via backend API.
* **On-chain verification** → `history.js` verifies every `txHash` against Sepolia.

## 🛠 Tech Stack

| Layer               | Technology                         |
| ------------------- | ---------------------------------- |
| **Smart Contracts** | Solidity, Truffle                  |
| **Blockchain**      | Ethereum Sepolia Testnet           |
| **Backend**         | Node.js, Express.js                |
| **Database**        | Supabase (PostgreSQL)              |
| **Frontend**        | Vanilla JS, Ethers.js v6, HTML/CSS |
| **Wallet**          | MetaMask                           |

## 📁 Project Structure

```text
Blockchain_Assignment/
├── abi/                          # Contract ABIs (JSON)
├── backend/                      # Node.js + Express server
│   ├── config/                   # Supabase client
│   ├── controllers/              # Route handlers
│   ├── middleware/               # Auth middleware
│   ├── models/                   # Supabase model helpers
│   ├── routes/                   # Express routes
│   ├── services/                 # Business logic
│   └── server.js                 # Entry point
├── contracts/                    # Solidity contracts
│   └── LogisticsEscrow.sol
├── frontend/
│   ├── css/                      # Stylesheets
│   ├── fragments/                # SPA page fragments (HTML)
│   ├── js/
│   │   ├── blockchain/           # web3_integration.js
│   │   ├── shared/               # common, api, state, auth, history
│   │   ├── shipper/              # Shipper page scripts
│   │   └── carrier/              # Carrier page scripts
│   └── views/                    # Full HTML pages
├── migrations/                   # Truffle migration scripts
├── test/                         # Truffle contract tests
├── .env                          # (Local only, do not commit)
├── .env.example                  # Environment template
├── package.json
├── truffle-config.js
└── README.md
```

## ✅ Prerequisites

Install these before starting:

| Tool     | Version            | Link                               |
| -------- | ------------------ | ---------------------------------- |
| Node.js  | 18.x or 20.x (LTS) | [nodejs.org](https://nodejs.org)   |
| npm      | 9.x+               | Bundled with Node                  |
| MetaMask | Latest             | [metamask.io](https://metamask.io) |
| Truffle  | 5.x                | `npm install -g truffle`           |

**Accounts you'll need:**

* **Supabase** project ([supabase.com](https://supabase.com))
* **Infura** or **Alchemy** project for Sepolia RPC ([infura.io](https://infura.io))
* A wallet with **Sepolia ETH** (from [sepoliafaucet.com](https://sepoliafaucet.com))

## ⚙️ Environment Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd Blockchain_Assignment

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 2. Create `.env` file

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# ─── Blockchain ────────────────────────────────────────
MNEMONIC="your twelve word seed phrase here"
INFURA_KEY="your_infura_project_id"
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"

# ─── Supabase ──────────────────────────────────────────
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# ─── Backend ───────────────────────────────────────────
PORT=3000
NODE_ENV=development
JWT_SECRET="change_this_to_a_random_secret"
```

> ⚠️ **Never commit `.env` to Git.** It should already be in `.gitignore`.

## 📜 Smart Contract Deployment

### 1. Compile

```bash
npx truffle compile
```

### 2. Migrate to Sepolia

```bash
npx truffle migrate --reset --network sepolia
```

Copy `contract address` printed in output.

### 3. Update Frontend Config

Open `frontend/js/blockchain/web3_integration.js`:

```javascript
const CONFIG = {
  contractAddress: "0xYourDeployedContractAddress...",
  abiPath: "/abi/LogisticsEscrow.json",
};
```

Copy updated ABI:

```bash
cp build/contracts/LogisticsEscrow.json frontend/abi/LogisticsEscrow.json
```

## 🗄 Database Setup

### 1. Create Supabase project

Go to Supabase → New Project → note URL and keys.

### 2. Run SQL Schema

Open **SQL Editor** in Supabase and run:

```sql
-- Users
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_address character varying NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['Shipper'::text, 'Carrier'::text])),
  display_name text NOT NULL,
  email text,
  reputation_balance integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Agreements
CREATE TABLE IF NOT EXISTS public.agreements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  onchain_id integer UNIQUE,
  agreement_name character varying,
  shipper_wallet character varying NOT NULL,
  carrier_wallet character varying NOT NULL,
  escrow_amount numeric NOT NULL,
  released_amount numeric DEFAULT 0,
  cargo_type character varying,
  weight_kg numeric,
  handling_instructions text,
  deadline timestamp with time zone NOT NULL,
  status character varying DEFAULT 'PendingAcceptance'
    CHECK (status IN (
      'PendingAcceptance',
      'AwaitingFunding',
      'Active',
      'Completed',
      'Rejected',
      'Cancelled',
      'Refunded',
      'Expired'
    )),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agreements_pkey PRIMARY KEY (id),
  CONSTRAINT agreements_shipper_fkey
    FOREIGN KEY (shipper_wallet)
    REFERENCES public.users(wallet_address),
  CONSTRAINT agreements_carrier_fkey
    FOREIGN KEY (carrier_wallet)
    REFERENCES public.users(wallet_address)
);

-- Milestones
CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  milestone_index integer NOT NULL,
  description text NOT NULL,
  payment_percentage integer NOT NULL,
  status character varying DEFAULT 'Pending'
    CHECK (status IN ('Pending','Submitted','Verified','Paid')),
  submitted_at timestamp with time zone,
  verified_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  proof_url text,
  CONSTRAINT milestones_pkey PRIMARY KEY (id),
  CONSTRAINT milestones_agreement_fkey
    FOREIGN KEY (agreement_onchain_id)
    REFERENCES public.agreements(onchain_id)
);

-- Escrow history
CREATE TABLE IF NOT EXISTS public.escrow_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  shipper_wallet character varying NOT NULL,
  amount numeric NOT NULL,
  transaction_hash text NOT NULL UNIQUE,
  funded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT escrow_history_pkey PRIMARY KEY (id),
  CONSTRAINT escrow_history_agreement_fkey
    FOREIGN KEY (agreement_onchain_id)
    REFERENCES public.agreements(onchain_id)
);

-- Payment history
CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  milestone_index integer NOT NULL,
  receiver_wallet character varying NOT NULL,
  amount numeric NOT NULL,
  transaction_hash text NOT NULL UNIQUE,
  paid_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_history_pkey PRIMARY KEY (id),
  CONSTRAINT payment_history_agreement_fkey
    FOREIGN KEY (agreement_onchain_id)
    REFERENCES public.agreements(onchain_id)
);

-- Refund history
CREATE TABLE IF NOT EXISTS public.refund_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  shipper_wallet character varying NOT NULL,
  amount numeric NOT NULL,
  transaction_hash text NOT NULL UNIQUE,
  refunded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT refund_history_pkey PRIMARY KEY (id),
  CONSTRAINT refund_history_agreement_fkey
    FOREIGN KEY (agreement_onchain_id)
    REFERENCES public.agreements(onchain_id)
);

-- Reputation history
CREATE TABLE IF NOT EXISTS public.reputation_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  carrier_wallet character varying NOT NULL,
  amount integer NOT NULL,
  transaction_hash text NOT NULL UNIQUE,
  rewarded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reputation_history_pkey PRIMARY KEY (id),
  CONSTRAINT reputation_history_agreement_fkey
    FOREIGN KEY (agreement_onchain_id)
    REFERENCES public.agreements(onchain_id)
);
```

## 💻 Backend Setup

### 1. Verify Supabase connection

Ensure `backend/config/supabase.js`:

```javascript
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
```

### 2. Start backend

```bash
cd backend
npm start
```

Expected:

```text
🚀 Server running on port 3000
✅ Connected to Supabase
```

## 🖥 Frontend Setup

Backend serves frontend statically.

Open:

```text
http://localhost:3000
```

Or serve separately:

```bash
npx serve frontend
```

## 🧪 Verify the New Environment Works

Run these checks before building features.

### Check 1 — Node, npm, Truffle

```bash
node --version
npm --version
truffle version
```

Expected:

```text
Node.js: v18.x or v20.x
npm: 9.x or higher
Truffle: v5.x
```

If Truffle missing:

```bash
npm install -g truffle
```

### Check 2 — Contract compiles

```bash
npx truffle compile
```

Expected:

```text
Compiling ./contracts/LogisticsEscrow.sol
Artifacts written to ./build/contracts
```

If fails → check `contracts/LogisticsEscrow.sol` and Solidity version in `truffle-config.js`.

### Check 3 — Deployment works

```bash
npx truffle migrate --reset --network sepolia
```

Expected → `LogisticsEscrow` deployed and `contract address: 0x...` printed.

Verify on Sepolia Etherscan:

```text
https://sepolia.etherscan.io/address/0xYourContractAddress
```

### Check 4 — Frontend contract config

Open `frontend/js/blockchain/web3_integration.js`:

```javascript
const CONFIG = {
  contractAddress: "0xYourDeployedContract...",
  abiPath: "/abi/LogisticsEscrow.json",
};
```

Browser DevTools:

```javascript
console.log(window.__CONFIG?.contractAddress);
```

Expected → same address as migration output.

### Check 5 — Backend boots

```bash
cd backend
npm start
```

Expected:

```text
🚀 Server running on port 3000
✅ Connected to Supabase
```

If fails:

```text
Cannot find module X
```

→ run `npm install` in backend.

```text
Supabase connection failed
```

→ check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Check 6 — Backend responds

New terminal:

```bash
curl http://localhost:3000/api/health
```

Expected:

```json
{"status":"ok"}
```

If fails:

* Connection refused → backend not running
* 404 → route not mounted; check `server.js`

### Check 7 — Supabase tables

Supabase → Table Editor.

Expected 7 tables:

```text
users
agreements
milestones
escrow_history
payment_history
refund_history
reputation_history
```

Missing table → rerun SQL schema.

### Check 8 — Backend → Supabase

```bash
cd backend
node -e "
const supabase = require('./config/supabase');
supabase.from('users').select('count', { count: 'exact', head: true })
  .then(({ count, error }) => {
    if (error) console.error('❌', error.message);
    else console.log('✅ Supabase OK — users count:', count);
  });
"
```

Expected:

```text
✅ Supabase OK — users count: 0
```

### Check 9 — MetaMask

1. Open MetaMask.
2. Switch to **Sepolia**.
3. Ensure account has Sepolia ETH.
4. Open `http://localhost:3000`.
5. Click **Connect Wallet**.
6. Approve in MetaMask.

Expected → wallet address appears; toast shows:

```text
Wallet connected.
```

Common failures:

```text
MetaMask not installed
```

→ install extension.

Infinite spinner → inspect console for CORS/network errors.

Wrong network → switch MetaMask to Sepolia.

### Check 10 — End-to-end test

Complete [Testing the Flow](#-testing-the-flow) with two wallets.

## 🧹 Optional — Reset Database

Use only for fresh development/demo testing.

> ⚠️ **This deletes all data permanently.** Only use in development.

### Full reset

```sql
TRUNCATE TABLE
  public.reputation_history,
  public.refund_history,
  public.payment_history,
  public.escrow_history,
  public.milestones,
  public.agreements,
  public.users
RESTART IDENTITY CASCADE;
```

Order matters: children first, then parents. `CASCADE` handles FK dependencies.

### Partial reset — keep users

```sql
TRUNCATE TABLE
  public.reputation_history,
  public.refund_history,
  public.payment_history,
  public.escrow_history,
  public.milestones,
  public.agreements
RESTART IDENTITY CASCADE;

UPDATE public.users SET reputation_balance = 0;
```

### History-only reset

```sql
TRUNCATE TABLE
  public.reputation_history,
  public.refund_history,
  public.payment_history,
  public.escrow_history
RESTART IDENTITY CASCADE;
```

### After truncate

Clear localStorage:

```javascript
Object.keys(localStorage)
  .filter(k => k.startsWith("agreements_") || k.startsWith("history_"))
  .forEach(k => localStorage.removeItem(k));
console.log("✅ Caches cleared");
```

Redeploy contract if fresh on-chain state needed:

```bash
npx truffle migrate --reset --network sepolia
```

Update `web3_integration.js` with new contract address.

Re-register both Shipper and Carrier.

## 🚀 Running the Full Stack

### Terminal 1 — Backend

```bash
cd backend
npm start
```

### Terminal 2 — Contract changes

If modifying `contracts/LogisticsEscrow.sol`:

```bash
npx truffle compile
npx truffle migrate --reset --network sepolia
```

Then update `web3_integration.js`.

### Browser

1. Open `http://localhost:3000`.
2. Connect MetaMask to **Sepolia**.
3. Register as Shipper using first account.
4. Switch MetaMask account.
5. Register as Carrier using second account.

## 🧪 Testing the Flow

### Prerequisites

* Two MetaMask accounts: Shipper + Carrier
* Both on **Sepolia**
* Both funded with test ETH

### Flow

| # | Actor   | Action           | Verify                                                |
| - | ------- | ---------------- | ----------------------------------------------------- |
| 1 | Shipper | Register         | `users` table has 1 row                               |
| 2 | Carrier | Register         | `users` table has 2 rows                              |
| 3 | Shipper | Create agreement | `agreements` + `milestones` populated                 |
| 4 | Carrier | Accept agreement | Status → `AwaitingFunding`                            |
| 5 | Shipper | Fund escrow      | `escrow_history` row + `agreements.status = 'Active'` |
| 6 | Carrier | Submit milestone | `milestones.status = 'Submitted'`                     |
| 7 | Shipper | Verify & release | `payment_history` row + `milestones.status = 'Paid'`  |
| 8 | Both    | Check History    | Verified on-chain                                     |

## 🔧 Troubleshooting

### `Cannot find module '../models/userModel'`

Fix → create:

```text
backend/models/userModel.js
```

### `MetaMask is not installed`

Fix → install MetaMask and refresh page.

### `Wrong network`

Fix → MetaMask → Network → **Sepolia**.

Chain ID:

```text
11155111
```

### `Transaction reverted`

Check transaction on Sepolia Etherscan and read revert reason.

### History page shows `❌ wrong contract`

Cause → contract redeployed with:

```bash
truffle migrate --reset
```

Old transactions point to old contract address.

Fix → truncate old DB rows or keep them as historical.

### History shows stale data

```javascript
Object.keys(localStorage)
  .filter(k => k.startsWith("history_") || k.startsWith("agreements_"))
  .forEach(k => localStorage.removeItem(k));
location.reload();
```

### `uws_win32_x64_137.node` warning

Cause → Truffle native WebSocket module not compiled for Node version.

Fix → ignore. Truffle falls back to pure-JS version.

Alternative → use Node 18/20 LTS.

### `Cannot find module 'truffle-config.cjs'`

Cause → config file is:

```text
truffle-config.js
```

Fix → remove `--config` flag:

```bash
npx truffle migrate --reset --network sepolia
```

## 🌿 Project Branch

This project uses **`main`** as its primary and active branch.

All latest project code, configuration, documentation, and updates should be maintained on:

```text
main
```

### Switch to `main`

```bash
git switch main
```

### Pull latest version

```bash
git pull origin main
```

### Verify current branch

```bash
git branch --show-current
```

Expected:

```text
main
```

### Clone latest project

```bash
git clone <your-repo-url>
cd Blockchain_Assignment
git switch main
```

> **Important:** Do not use branch `tttt` for current project development. `main` is current project branch.

## 📄 License

MIT — see `LICENSE` file.

---

**Last updated:** September 2026
