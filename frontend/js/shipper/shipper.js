// ─── SPA ROUTER ──────────────────────────────────────────
const ROLE_PATH = "/shipper";

document.addEventListener("DOMContentLoaded", function () {
  (async function () {
    const contentEl = document.getElementById("contentPlaceholder");

    if (!contentEl) {
      console.error("❌ contentPlaceholder not found. Router cannot start.");
      return;
    }

    // ============================================================
    // SESSION GUARD
    // ============================================================

    const sessionOk = await window.Auth.ensureFullSession();

    if (!sessionOk) {
      // Redirect already handled by ensureFullSession()
      return;
    }

    // ============================================================
    // UPDATE SIDEBAR
    // ============================================================

    await updateSidebarUser();

    // ============================================================
    // ROUTER SETUP
    // ============================================================

    const navItems = document.querySelectorAll(".nav-item[data-page]");

    const pageTitleEl = document.getElementById("pageTitle");

    const pageSubEl = document.getElementById("pageSub");

    const topbarActions = document.querySelector(".topbar-actions");

    // ============================================================
    // PAGE MAPPING
    // ============================================================

    const pageMap = {
      agreements: {
        file: "/fragments/shared/agreements.html",
        title: "Agreements",
        sub: "All logistics agreements you're party to as a Shipper",
        button: {
          label: "+ Create Agreement",
          page: "create_agreement",
        },
      },

      create_agreement: {
        file: "/fragments/shipper/create_agreement.html",
        title: "Create Agreement",
        sub: "Start a new logistics contract with a Carrier",
      },

      deposit_balance: {
        file: "/fragments/shipper/deposit_balance.html",
        title: "Escrow Overview",
        sub: "View your locked and available escrow balances",
      },

      milestone_release: {
        file: "/fragments/shipper/milestone_release.html",
        title: "Milestone Tracking",
        sub: "Track and verify delivery milestones",
      },

      refund_expiry: {
        file: "/fragments/shipper/refund_expiry.html",
        title: "Refund Centre",
        sub: "Manage refunds and expiry of agreements",
      },

      history: {
        file: "/fragments/shared/history.html",
        title: "Transaction History",
        sub: "Complete record of all your transactions",
      },

      profile: {
        file: "/fragments/shipper/shipper_profile.html",
        title: "My Profile",
        sub: "Manage your shipper account and activity",
      },

      settings: {
        file: "/fragments/shipper/settings.html",
        title: "Settings",
        sub: "Configure your account preferences",
      },
    };

    // ============================================================
    // PAGE DETAILS
    // ============================================================

    function getPageDetails(pageKey) {
      if (pageKey === "agreement_details") {
        const id =
          new URLSearchParams(window.location.search).get("id") || "AG8901";

        return {
          file: `/fragments/shipper/agreement_details_shipper.html?id=${id}`,

          title: "Agreement Details",

          sub: "Manage escrow, milestones, and disputes for this agreement",
        };
      }

      return pageMap[pageKey] || null;
    }

    // ============================================================
    // TOPBAR BUTTON
    // ============================================================

    let topbarButtonElement = null;

    function updateTopbarButton(pageKey) {
      if (topbarButtonElement) {
        topbarButtonElement.remove();

        topbarButtonElement = null;
      }

      const details = getPageDetails(pageKey);

      if (details && details.button && topbarActions) {
        const btn = document.createElement("button");

        btn.className = "btn btn-primary";

        btn.textContent = details.button.label;

        btn.onclick = function () {
          window.loadPage(details.button.page);
        };

        topbarActions.appendChild(btn);

        topbarButtonElement = btn;
      }
    }

    // ============================================================
    // DASHBOARD HTML
    // ============================================================

    // ============================================================
    // DASHBOARD HTML + CSS
    // ============================================================

    function getDashboardHTML() {
      return `
    <style>
      /* ========================================================
         TRAXEN SPA DASHBOARD
         CSS is scoped ONLY to #contentPlaceholder
         ======================================================== */

      #contentPlaceholder .traxen-dashboard {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 4px 0 32px;
        color: var(--text);
      }

      #contentPlaceholder .traxen-dashboard *,
      #contentPlaceholder .traxen-dashboard *::before,
      #contentPlaceholder .traxen-dashboard *::after {
        box-sizing: border-box;
      }

      /* ========================================================
         STATISTICS
         ======================================================== */

      #contentPlaceholder .dashboard-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }

      #contentPlaceholder .dashboard-stat-card {
        position: relative;
        min-width: 0;
        min-height: 124px;

        padding: 20px;

        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: 14px;

        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.10);

        overflow: hidden;

        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          border-color 0.18s ease;
      }

      #contentPlaceholder .dashboard-stat-card::before {
        content: "";

        position: absolute;
        top: 0;
        left: 0;
        right: 0;

        height: 3px;

        background: var(--border-soft);
      }

      #contentPlaceholder .dashboard-stat-card.primary::before {
        background: var(--lime);
      }

      #contentPlaceholder .dashboard-stat-card.amber::before {
        background: var(--amber);
      }

      #contentPlaceholder .dashboard-stat-card:hover {
        transform: translateY(-2px);

        border-color: var(--border);

        box-shadow:
          0 8px 22px rgba(0, 0, 0, 0.16);
      }

      #contentPlaceholder .dashboard-stat-label {
        margin-bottom: 10px;

        font-size: 10.5px;
        font-weight: 700;
        line-height: 1.3;

        text-transform: uppercase;
        letter-spacing: 0.07em;

        color: var(--text-faint);
      }

      #contentPlaceholder .dashboard-stat-value {
        font-size: 27px;
        line-height: 1.15;
        font-weight: 800;
        letter-spacing: -0.02em;

        color: var(--text);
      }

      #contentPlaceholder .dashboard-stat-value.lime {
        color: var(--lime);
      }

      #contentPlaceholder .dashboard-stat-value.amber {
        color: var(--amber);
      }

      #contentPlaceholder .dashboard-stat-delta {
        margin-top: 8px;

        font-size: 11px;
        line-height: 1.4;

        color: var(--text-faint);
      }

      /* ========================================================
         MAIN DASHBOARD GRID
         ======================================================== */

      #contentPlaceholder .dashboard-grid {
        display: grid;

        grid-template-columns:
          minmax(0, 1.65fr)
          minmax(300px, 1fr);

        gap: 18px;

        align-items: stretch;
      }

      /* ========================================================
         PANELS
         ======================================================== */

      #contentPlaceholder .dashboard-panel {
        min-width: 0;

        padding: 22px;

        background: var(--panel);

        border: 1px solid var(--border-soft);

        border-radius: 14px;

        box-shadow:
          0 4px 14px rgba(0, 0, 0, 0.09);

        overflow: hidden;
      }

      #contentPlaceholder .dashboard-panel-head {
        display: flex;

        align-items: flex-start;
        justify-content: space-between;

        gap: 16px;

        margin-bottom: 18px;
        padding-bottom: 14px;

        border-bottom: 1px solid var(--border-soft);
      }

      #contentPlaceholder .dashboard-panel h2 {
        margin: 0;

        font-size: 15px;
        line-height: 1.35;
        font-weight: 700;

        color: var(--text);
      }

      #contentPlaceholder .dashboard-desc {
        margin-top: 4px;

        font-size: 11.5px;
        line-height: 1.45;

        color: var(--text-faint);
      }

      /* ========================================================
         LOADING / EMPTY
         ======================================================== */

      #contentPlaceholder .dashboard-loading {
        display: flex;

        align-items: center;
        justify-content: center;

        min-height: 140px;

        padding: 24px;

        text-align: center;

        background: var(--panel-2);

        border: 1px dashed var(--border);

        border-radius: 10px;

        color: var(--text-faint);

        font-size: 12px;
      }

      /* ========================================================
         RECENT AGREEMENTS TABLE
         ======================================================== */

      #contentPlaceholder .dashboard-table-wrap {
        width: 100%;

        overflow-x: auto;

        border: 1px solid var(--border-soft);

        border-radius: 10px;
      }

      #contentPlaceholder .dashboard-table {
        width: 100%;
        min-width: 500px;

        border-collapse: collapse;
      }

      #contentPlaceholder .dashboard-table th {
        padding: 11px 12px;

        background: var(--panel-2);

        border-bottom: 1px solid var(--border-soft);

        color: var(--text-faint);

        font-size: 10.5px;
        font-weight: 700;

        text-align: left;

        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      #contentPlaceholder .dashboard-table td {
        padding: 13px 12px;

        border-bottom: 1px solid var(--border-soft);

        color: var(--text);

        font-size: 12px;

        vertical-align: middle;
      }

      #contentPlaceholder .dashboard-table tbody tr {
        transition: background 0.15s ease;
      }

      #contentPlaceholder .dashboard-table tbody tr:hover {
        background: var(--panel-2);
      }

      #contentPlaceholder .dashboard-table tbody tr:last-child td {
        border-bottom: none;
      }

      #contentPlaceholder .dashboard-mono {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--text-dim);
      }

      /* ========================================================
         STATUS
         ======================================================== */

      #contentPlaceholder .dashboard-status {
        display: inline-flex;

        align-items: center;

        gap: 5px;

        padding: 4px 9px;

        border-radius: 999px;

        font-size: 10.5px;
        font-weight: 700;

        white-space: nowrap;
      }

      #contentPlaceholder .dashboard-status .dot {
        width: 5px;
        height: 5px;

        border-radius: 50%;

        background: currentColor;
      }

      #contentPlaceholder .dashboard-status.active {
        background: var(--lime-glow);
        color: var(--lime);
      }

      #contentPlaceholder .dashboard-status.pending {
        background: var(--amber-glow);
        color: var(--amber);
      }

      #contentPlaceholder .dashboard-status.completed {
        background: var(--panel-2);
        border: 1px solid var(--border);

        color: var(--text-faint);
      }

      #contentPlaceholder .dashboard-status.cancelled {
        background: var(--red-glow);
        color: var(--red);
      }

      /* ========================================================
         BUTTONS
         ======================================================== */

      #contentPlaceholder .dashboard-actions {
        display: flex;

        flex-direction: column;

        gap: 10px;

        margin-top: 14px;
      }

      #contentPlaceholder .dashboard-action {
        width: 100%;
      }

      #contentPlaceholder .dashboard-divider {
        margin: 20px 0;

        border: 0;

        border-top: 1px solid var(--border-soft);
      }

      /* ========================================================
         MILESTONE
         ======================================================== */

      #contentPlaceholder .dashboard-milestone-header {
        display: flex;

        align-items: center;
        justify-content: space-between;

        gap: 12px;

        margin-bottom: 10px;

        font-size: 12px;

        color: var(--text-faint);
      }

      #contentPlaceholder #next-milestone-days {
        color: var(--amber);

        font-weight: 700;
      }

      #contentPlaceholder .dashboard-progress {
        width: 100%;
        height: 8px;

        margin-bottom: 12px;

        overflow: hidden;

        background: var(--panel-2);

        border: 1px solid var(--border-soft);

        border-radius: 999px;
      }

      #contentPlaceholder .dashboard-progress-fill {
        width: 0%;
        height: 100%;

        background: var(--lime);

        border-radius: inherit;

        transition: width 0.35s ease;
      }

      #contentPlaceholder .dashboard-milestones {
        display: grid;

        grid-template-columns:
          repeat(4, minmax(0, 1fr));

        gap: 6px;

        font-size: 9.5px;
        line-height: 1.35;

        color: var(--text-faint);

        text-align: center;
      }

      /* ========================================================
         RESPONSIVE
         ======================================================== */

      @media (max-width: 1050px) {
        #contentPlaceholder .dashboard-stats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        #contentPlaceholder .dashboard-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 650px) {
        #contentPlaceholder .dashboard-stats {
          grid-template-columns: 1fr;
        }

        #contentPlaceholder .dashboard-panel {
          padding: 17px;
        }

        #contentPlaceholder .dashboard-panel-head {
          flex-direction: column;
        }

        #contentPlaceholder .dashboard-milestones {
          font-size: 8.5px;
        }
      }
    </style>

    <div class="traxen-dashboard">

      <!-- ======================================================
           STATISTICS
           ====================================================== -->

      <div class="dashboard-stats">

        <div class="dashboard-stat-card primary">
          <div class="dashboard-stat-label">
            Total Agreements
          </div>

          <div
            class="dashboard-stat-value lime"
            id="stat-total"
          >
            0
          </div>

          <div
            class="dashboard-stat-delta"
            id="stat-total-delta"
          >
            Loading...
          </div>
        </div>


        <div class="dashboard-stat-card">
          <div class="dashboard-stat-label">
            Active Agreements
          </div>

          <div
            class="dashboard-stat-value"
            id="stat-active"
          >
            0
          </div>

          <div class="dashboard-stat-delta">
            Currently in progress
          </div>
        </div>


        <div class="dashboard-stat-card">
          <div class="dashboard-stat-label">
            Completed
          </div>

          <div
            class="dashboard-stat-value"
            id="stat-completed"
          >
            0
          </div>

          <div class="dashboard-stat-delta">
            Successfully completed
          </div>
        </div>


        <div class="dashboard-stat-card amber">
          <div class="dashboard-stat-label">
            Total Escrow
          </div>

          <div
            class="dashboard-stat-value amber"
            id="stat-escrow"
          >
            0.00
          </div>

          <div class="dashboard-stat-delta">
            ETH secured in contracts
          </div>
        </div>

      </div>


      <!-- ======================================================
           MAIN DASHBOARD
           ====================================================== -->

      <div class="dashboard-grid">

        <!-- ====================================================
             RECENT AGREEMENTS
             ==================================================== -->

        <section class="dashboard-panel">

          <div class="dashboard-panel-head">
            <div>
              <h2>Recent Agreements</h2>

              <div class="dashboard-desc">
                Your latest verified logistics contracts
              </div>
            </div>
          </div>


          <div id="recent-agreements-list">

            <div class="dashboard-loading">
              Verifying agreements on the blockchain...
            </div>

          </div>


          <div class="dashboard-actions">

            <button
              class="btn btn-ghost dashboard-action"
              onclick="window.loadPage('agreements')"
            >
              View All Agreements →
            </button>

          </div>

        </section>


        <!-- ====================================================
             QUICK ACTIONS
             ==================================================== -->

        <section class="dashboard-panel">

          <div class="dashboard-panel-head">
            <div>
              <h2>Quick Actions</h2>

              <div class="dashboard-desc">
                Manage your logistics agreements
              </div>
            </div>
          </div>


          <div class="dashboard-actions">

            <button
              class="btn btn-primary btn-block dashboard-action"
              onclick="window.loadPage('create_agreement')"
            >
              + Create New Agreement
            </button>

            <button
              class="btn btn-primary btn-block dashboard-action"
              onclick="window.loadPage('deposit_balance')"
            >
              💰 View Escrow Balances
            </button>

            <button
              class="dashboard-action-button"
              onclick="window.loadPage('milestone_release')"
            >
              📍 Track Milestones
            </button>

          </div>


          <hr class="dashboard-divider">


          <!-- MILESTONE -->

          <div>

            <div class="dashboard-milestone-header">

              <span>
                Next Milestone Due
              </span>

              <span id="next-milestone-days">
                --
              </span>

            </div>


            <div class="dashboard-progress">

              <div
                class="dashboard-progress-fill"
                id="milestone-progress"
              ></div>

            </div>


            <div class="dashboard-milestones">

              <span>Pickup ✓</span>

              <span>In Transit</span>

              <span>Out for Delivery</span>

              <span>Delivered</span>

            </div>

          </div>

        </section>

      </div>

    </div>
  `;
    }

    // ============================================================
    // LOAD DASHBOARD STATS
    // ============================================================

    async function loadDashboardStats() {
      try {
        // ========================================================
        // 1. Get authenticated JWT
        // ========================================================
        const token =
          typeof window.getAuthToken === "function"
            ? window.getAuthToken()
            : localStorage.getItem("traxenAuthToken");

        if (!token) {
          console.warn("❌ No JWT available.");
          return;
        }

        // ========================================================
        // 2. Get agreements from DATABASE
        // ========================================================
        const response = await fetch("/api/agreements", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch agreements: HTTP ${response.status}`,
          );
        }

        const databaseAgreements = await response.json();

        console.log("📦 Database agreements:", databaseAgreements);

        // ========================================================
        // 3. Validate CURRENT MetaMask network
        // ========================================================
        if (!window.ethereum) {
          throw new Error("MetaMask is not available.");
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();

        const currentChainId = Number(network.chainId);

        // Sepolia
        const expectedChainId = 11155111;

        console.log("🌐 Current chain ID:", currentChainId);

        if (currentChainId !== expectedChainId) {
          console.warn(
            `❌ Wrong network. Expected Sepolia (${expectedChainId}), got ${currentChainId}.`,
          );

          const recentContainer = document.getElementById(
            "recent-agreements-list",
          );

          if (recentContainer) {
            recentContainer.innerHTML = `
          <div style="
            padding:20px;
            text-align:center;
            color:var(--text-faint);
          ">
            <strong>Wrong blockchain network</strong><br>
            Please switch MetaMask to Sepolia to verify your agreements.
          </div>
        `;
          }

          // Do not display database agreements on a wrong network.
          if (document.getElementById("stat-total")) {
            document.getElementById("stat-total").textContent = "0";
          }

          if (document.getElementById("stat-active")) {
            document.getElementById("stat-active").textContent = "0";
          }

          if (document.getElementById("stat-completed")) {
            document.getElementById("stat-completed").textContent = "0";
          }

          if (document.getElementById("stat-escrow")) {
            document.getElementById("stat-escrow").textContent = "0.00";
          }

          if (document.getElementById("stat-total-delta")) {
            document.getElementById("stat-total-delta").textContent =
              "No verified agreements";
          }

          return;
        }

        // ========================================================
        // 4. Get CURRENT contract address
        // ========================================================
        let contractAddress = window.__CONFIG?.contractAddress || null;

        if (!contractAddress && window.contract) {
          contractAddress = await window.contract.getAddress();
        }

        if (!contractAddress) {
          throw new Error("Blockchain contract address is not configured.");
        }

        let contract;

        // ========================================================
        // 5. Make sure active contract matches configured address
        // ========================================================
        if (window.contract) {
          const activeContractAddress = await window.contract.getAddress();

          if (
            activeContractAddress.toLowerCase() !==
            contractAddress.toLowerCase()
          ) {
            throw new Error(
              "Active Web3 contract does not match the configured contract address.",
            );
          }

          // Read-only contract for validation
          const abi =
            typeof window.__loadContractABI === "function"
              ? await window.__loadContractABI()
              : null;

          if (abi) {
            contract = new ethers.Contract(contractAddress, abi, provider);
          } else {
            contract = window.contract;
          }
        } else {
          const abi =
            typeof window.__loadContractABI === "function"
              ? await window.__loadContractABI()
              : null;

          if (!abi) {
            throw new Error("Contract ABI is not available.");
          }

          contract = new ethers.Contract(contractAddress, abi, provider);
        }

        console.log("📄 Current contract address:", contractAddress);

        console.log("🌐 Contract network chain ID:", currentChainId);

        // ========================================================
        // 6. Get authenticated Shipper wallet
        // ========================================================
        const authenticatedWallet =
          typeof window.Auth?.getWallet === "function"
            ? window.Auth.getWallet()
            : localStorage.getItem("traxenWallet");

        const shipperWallet = authenticatedWallet
          ? authenticatedWallet.toLowerCase()
          : null;

        // ========================================================
        // 7. Verify EVERY database agreement on blockchain
        // ========================================================
        const verifiedAgreements = [];

        for (const dbAgreement of Array.isArray(databaseAgreements)
          ? databaseAgreements
          : []) {
          const agreementId = Number(dbAgreement.onchain_id);

          if (!Number.isInteger(agreementId) || agreementId <= 0) {
            console.warn(
              "⚠️ Invalid database onchain_id:",
              dbAgreement.onchain_id,
            );

            continue;
          }

          try {
            console.log(
              `🔍 Verifying database agreement #${agreementId} on Sepolia...`,
            );

            // ------------------------------------------------------
            // Ask CURRENT blockchain contract for this agreement
            // ------------------------------------------------------
            const chainAgreement = await contract.getAgreement(agreementId);

            // ------------------------------------------------------
            // Verify the agreement belongs to this Shipper
            // ------------------------------------------------------
            const chainShipper = String(chainAgreement.shipper).toLowerCase();

            if (shipperWallet && chainShipper !== shipperWallet) {
              console.warn(
                `⚠️ Agreement #${agreementId} exists, but blockchain shipper does not match the authenticated Shipper.`,
              );

              // Part A fix : keep the row (flagged) instead of dropping it, so a
              // mismatch or RPC hiccup can never blank the dashboard.
              verifiedAgreements.push({
                ...dbAgreement,
                blockchainVerified: false,
              });

              continue;
            }

            // ------------------------------------------------------
            // Verify returned blockchain ID
            // ------------------------------------------------------
            if (
              chainAgreement[0] !== undefined &&
              Number(chainAgreement[0]) !== agreementId
            ) {
              console.warn(
                `⚠️ Agreement #${agreementId} returned a different on-chain ID.`,
              );

              // Part A fix : keep the row instead of dropping it.
              verifiedAgreements.push({
                ...dbAgreement,
                blockchainVerified: false,
              });

              continue;
            }

            // ------------------------------------------------------
            // Agreement is valid
            // ------------------------------------------------------
            verifiedAgreements.push({
              ...dbAgreement,

              blockchainVerified: true,
              blockchainChainId: currentChainId,
              blockchainContractAddress: contractAddress,
              blockchainAgreement: chainAgreement,
            });

            console.log(`✅ Agreement #${agreementId} verified.`);
          } catch (chainError) {
            // ------------------------------------------------------
            // Agreement does NOT exist on current network/contract
            // ------------------------------------------------------
            console.warn(
              `⚠️ Agreement #${agreementId} could not be verified on the current Sepolia contract:`,
              chainError.reason || chainError.message,
            );

            // Part A fix : show the row as unverified instead of hiding it.
            verifiedAgreements.push({
              ...dbAgreement,
              blockchainVerified: false,
            });
          }
        }

        console.log("✅ Verified agreements:", verifiedAgreements);

        // ========================================================
        // 8. ONLY VERIFIED AGREEMENTS ARE DISPLAYED
        // ========================================================
        const agreements = verifiedAgreements;

        // ========================================================
        // 9. Statistics
        // ========================================================
        const total = agreements.length;

        const active = agreements.filter(
          (a) => a.status === "Active" || a.status === "AwaitingFunding",
        ).length;

        const completed = agreements.filter(
          (a) => a.status === "Completed",
        ).length;

        let totalEscrow = 0;

        agreements.forEach((a) => {
          try {
            const wei = a.escrow_amount ? String(a.escrow_amount) : "0";

            const eth = parseFloat(ethers.formatEther(wei));

            if (!isNaN(eth)) {
              totalEscrow += eth;
            }
          } catch (e) {
            // Ignore invalid escrow values.
          }
        });

        // ========================================================
        // 10. Update statistics
        // ========================================================
        const totalEl = document.getElementById("stat-total");

        const activeEl = document.getElementById("stat-active");

        const completedEl = document.getElementById("stat-completed");

        const escrowEl = document.getElementById("stat-escrow");

        const totalDeltaEl = document.getElementById("stat-total-delta");

        if (totalEl) {
          totalEl.textContent = total;
        }

        if (activeEl) {
          activeEl.textContent = active;
        }

        if (completedEl) {
          completedEl.textContent = completed;
        }

        if (escrowEl) {
          escrowEl.textContent = totalEscrow.toFixed(2);
        }

        if (totalDeltaEl) {
          totalDeltaEl.textContent =
            total > 0
              ? `${total} verified agreement${total > 1 ? "s" : ""}`
              : "No verified agreements";
        }

        // ========================================================
        // 11. Display ONLY verified recent agreements
        // ========================================================
        const recentContainer = document.getElementById(
          "recent-agreements-list",
        );

        if (!recentContainer) {
          return;
        }

        const recent = agreements.slice(-3).reverse();

        if (recent.length === 0) {
          recentContainer.innerHTML = `
        <div style="
          padding:20px;
          text-align:center;
          color:var(--text-faint);
        ">
          No verified agreements found.
        </div>
      `;
        } else {
          let html = `
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Carrier</th>
              <th>Status</th>
              <th>Value</th>
            </tr>
          </thead>

          <tbody>
      `;

          recent.forEach((a) => {
            const status = a.status || "Unknown";

            let pillClass = "pill gray";

            if (status === "Active" || status === "AwaitingFunding") {
              pillClass = "pill lime";
            } else if (status === "PendingAcceptance") {
              pillClass = "pill amber";
            } else if (status === "Completed") {
              pillClass = "pill gray";
            }

            const value = a.escrow_amount
              ? parseFloat(ethers.formatEther(String(a.escrow_amount))).toFixed(
                  2,
                )
              : "0.00";

            const carrierName =
              a.carrier?.display_name ||
              a.carrier?.wallet_address ||
              a.carrier_wallet ||
              a.carrier ||
              "Unknown";

            html += `
          <tr>
            <td>
              <span class="mono">
                #${a.onchain_id || "—"}
              </span>
            </td>

            <td>
              ${carrierName}
            </td>

            <td>
              <span class="${pillClass}">
                <span class="dot"></span>
                ${status}
              </span>
            </td>

            <td>
              ${value} ETH
            </td>
          </tr>
        `;
          });

          html += `
          </tbody>
        </table>
      `;

          recentContainer.innerHTML = html;
        }

        // ========================================================
        // 12. Milestone progress
        // ========================================================
        const activeAgreement = agreements.find(
          (a) => a.status === "Active" || a.status === "AwaitingFunding",
        );

        const progressEl = document.getElementById("milestone-progress");

        const nextMilestoneEl = document.getElementById("next-milestone-days");

        if (
          activeAgreement &&
          activeAgreement.milestones &&
          activeAgreement.milestones.length > 0
        ) {
          const totalMilestones = activeAgreement.milestones.length;

          const paid = activeAgreement.milestones.filter(
            (m) => m.status === "Paid",
          ).length;

          const progress =
            totalMilestones > 0 ? (paid / totalMilestones) * 100 : 0;

          if (progressEl) {
            progressEl.style.width = progress + "%";
          }

          if (nextMilestoneEl) {
            nextMilestoneEl.textContent = "3 days";
          }
        } else {
          if (nextMilestoneEl) {
            nextMilestoneEl.textContent = "No active agreement";
          }

          if (progressEl) {
            progressEl.style.width = "0%";
          }
        }
      } catch (error) {
        console.error("❌ Dashboard verification error:", error);

        const recentContainer = document.getElementById(
          "recent-agreements-list",
        );

        if (recentContainer) {
          recentContainer.innerHTML = `
        <div style="
          padding:20px;
          text-align:center;
          color:var(--text-faint);
        ">
          Unable to verify agreements.
        </div>
      `;
        }
      }
    }

    // ============================================================
    // UPDATE SIDEBAR USER
    // ============================================================

    async function updateSidebarUser() {
      try {
        // --------------------------------------------------------
        // 1. Get JWT
        // --------------------------------------------------------

        const token =
          typeof window.getAuthToken === "function"
            ? window.getAuthToken()
            : localStorage.getItem("traxenAuthToken");

        // --------------------------------------------------------
        // 2. Get authenticated wallet
        // --------------------------------------------------------

        const wallet =
          typeof window.Auth?.getWallet === "function"
            ? window.Auth.getWallet()
            : localStorage.getItem("traxenWallet");

        if (!token || !wallet) {
          console.warn("❌ No authenticated shipper session found.");

          return;
        }

        // --------------------------------------------------------
        // 3. Get current user from backend
        // --------------------------------------------------------

        const response = await fetch("/api/users/me", {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to retrieve current user: HTTP ${response.status}`,
          );
        }

        const user = await response.json();

        // --------------------------------------------------------
        // 4. Verify wallet
        // --------------------------------------------------------

        if (
          !user.wallet_address ||
          user.wallet_address.toLowerCase() !== wallet.toLowerCase()
        ) {
          throw new Error(
            "Backend wallet does not match authenticated wallet.",
          );
        }

        // --------------------------------------------------------
        // 5. Verify Shipper role
        // --------------------------------------------------------

        if (user.role !== "Shipper") {
          throw new Error("Authenticated user is not a Shipper.");
        }

        // --------------------------------------------------------
        // 6. Synchronize Auth storage
        // --------------------------------------------------------

        if (window.Auth && typeof window.Auth.setAuthData === "function") {
          window.Auth.setAuthData(
            user.wallet_address,

            user.role,

            user.display_name || "Shipper",

            user.email || "",
          );
        }

        // --------------------------------------------------------
        // 7. Update sidebar
        // --------------------------------------------------------

        const nameEl = document.getElementById("miniName");

        const roleEl = document.getElementById("miniRole");

        const avatarEl = document.getElementById("miniAvatar");

        const displayName = user.display_name || "Shipper";

        const displayRole = user.role || "Shipper";

        if (nameEl) {
          nameEl.textContent = displayName;
        }

        if (roleEl) {
          roleEl.textContent = displayRole;
        }

        if (avatarEl) {
          const initials = displayName
            .trim()
            .split(/\s+/)
            .map((part) => part.charAt(0))
            .join("")
            .substring(0, 2)
            .toUpperCase();

          avatarEl.textContent = initials || "SH";
        }

        console.log("✅ Shipper sidebar synchronized.");

        console.log("✅ Current user:", user.display_name);

        console.log("✅ Current role:", user.role);
      } catch (error) {
        console.error("❌ Failed to synchronize shipper sidebar:", error);

        // Clear invalid session.

        if (window.Auth && typeof window.Auth.clearAuthData === "function") {
          window.Auth.clearAuthData();
        }

        window.location.href = "/connect.html";
      }
    }

    // ============================================================
    // CACHE
    // ============================================================

    const templateCache = {};

    // ============================================================
    // PAGE INITIALIZATION
    // ============================================================

    async function runPageInit(pageKey, details) {
      // --------------------------------------------------------
      // Navigation
      // --------------------------------------------------------

      navItems.forEach((el) => el.classList.remove("active"));

      const active = Array.from(navItems).find(
        (el) => el.dataset.page === pageKey,
      );

      if (active) {
        active.classList.add("active");
      }

      // --------------------------------------------------------
      // Page title
      // --------------------------------------------------------

      if (pageTitleEl) {
        pageTitleEl.textContent = details.title;
      }

      if (pageSubEl) {
        pageSubEl.textContent = details.sub;
      }

      document.title = `Traxen — ${details.title}`;

      // --------------------------------------------------------
      // Topbar
      // --------------------------------------------------------

      updateTopbarButton(pageKey);

      // --------------------------------------------------------
      // Fragment initialization
      // --------------------------------------------------------

      const pageInits = {
        agreements: "initAgreements",

        create_agreement: "initCreateAgreement",

        deposit_balance: "initDepositBalance",

        milestone_release: "initMilestoneRelease",

        refund_expiry: "initRefundExpiry",

        history: "initHistory",

        profile: "initProfile",

        settings: "initSettings",

        agreement_details: "initAgreementDetails",
      };

      const initName = pageInits[pageKey];

      if (initName && typeof window[initName] === "function") {
        await window[initName]();
      }
    }

    // ============================================================
    // LOAD PAGE
    // ============================================================

    async function loadPage(pageKey) {
      // --------------------------------------------------------
      // Always validate session before navigation
      // --------------------------------------------------------

      const sessionOk = await window.Auth.ensureFullSession();

      if (!sessionOk) {
        return;
      }

      // --------------------------------------------------------
      // Normalize dashboard name
      // --------------------------------------------------------

      if (pageKey === "dashboard") {
        pageKey = "shipper_dashboard";
      }

      // ========================================================
      // DASHBOARD
      // ========================================================

      if (pageKey === "shipper_dashboard") {
        contentEl.innerHTML = getDashboardHTML();

        // Synchronize current user.

        await updateSidebarUser();

        // Remove dashboard topbar button.

        updateTopbarButton(null);

        // Active dashboard navigation.

        navItems.forEach((el) => el.classList.remove("active"));

        const active = Array.from(navItems).find(
          (el) => el.dataset.page === "dashboard",
        );

        if (active) {
          active.classList.add("active");
        }

        if (pageTitleEl) {
          pageTitleEl.textContent = "Dashboard";
        }

        const userName =
          typeof window.Auth?.getName === "function"
            ? window.Auth.getName()
            : localStorage.getItem("traxenUserName");

        if (pageSubEl) {
          pageSubEl.textContent = `Welcome back, ${userName || "User"}!`;
        }

        // Load dashboard data.

        await loadDashboardStats();

        return;
      }

      // ========================================================
      // FIND PAGE DETAILS
      // ========================================================

      const details = getPageDetails(pageKey);

      if (!details) {
        contentEl.innerHTML = `
          <div
            style="
              padding:40px;
              color:var(--red);
            "
          >
            ❌ Page not found:
            ${pageKey}
          </div>
        `;

        return;
      }

      const url = details.file;

      // ========================================================
      // CACHE
      // ========================================================

      if (templateCache[url]) {
        contentEl.innerHTML = templateCache[url];

        await runPageInit(pageKey, details);

        return;
      }

      // ========================================================
      // LOADING MESSAGE
      // ========================================================

      contentEl.innerHTML = `
        <div
          style="
            padding:40px;
            text-align:center;
            color:var(--text-faint);
          "
        >
          Loading...
        </div>
      `;

      // ========================================================
      // FETCH FRAGMENT
      // ========================================================

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        const parser = new DOMParser();

        const doc = parser.parseFromString(html, "text/html");

        const newContent = doc.querySelector(".content");

        if (!newContent) {
          throw new Error("Invalid fragment: missing .content element");
        }

        // ------------------------------------------------------
        // Cache fragment
        // ------------------------------------------------------

        templateCache[url] = newContent.innerHTML;

        // ------------------------------------------------------
        // Render fragment
        // ------------------------------------------------------

        contentEl.innerHTML = newContent.innerHTML;

        // ------------------------------------------------------
        // Initialize fragment
        // ------------------------------------------------------

        await runPageInit(pageKey, details);
      } catch (error) {
        console.error("Load error:", error);

        contentEl.innerHTML = `
          <div
            style="
              padding:40px;
              color:var(--red);
            "
          >
            ❌ Failed to load page:
            ${error.message}
          </div>
        `;
      }
    }

    // ============================================================
    // NAVIGATION CLICK HANDLERS
    // ============================================================

    let navigationInProgress = false;

    navItems.forEach((item) => {
      item.addEventListener("click", async function (e) {
        e.preventDefault();

        const page = this.dataset.page;

        // Prevent two SPA navigations from running at the same time.
        if (navigationInProgress) {
          console.warn("⏳ Navigation already in progress:", page);
          return;
        }

        navigationInProgress = true;

        try {
          await loadPage(page);

          const targetUrl = `${ROLE_PATH}/${page}.html`;

          if (window.location.pathname !== targetUrl) {
            window.history.pushState({ page }, "", targetUrl);
          }
        } catch (error) {
          console.error("❌ Navigation failed:", error);
        } finally {
          navigationInProgress = false;
        }
      });
    });

    // ============================================================
    // BACK / FORWARD NAVIGATION
    // ============================================================

    const availablePages = [
      "shipper_dashboard",

      ...Object.keys(pageMap),

      "agreement_details",
    ];

    window.addEventListener("popstate", function (e) {
      if (e.state && e.state.page) {
        loadPage(e.state.page);

        return;
      }

      // ------------------------------------------------------
      // Parse URL
      // ------------------------------------------------------

      const path = window.location.pathname;

      const segments = path.split("/").filter((s) => s.length > 0);

      let pageKey = "shipper_dashboard";

      if (segments.length >= 2 && segments[0] === "shipper") {
        const raw = segments[1].replace(".html", "");

        if (raw === "agreement_details_shipper") {
          pageKey = "agreement_details";
        } else if (pageMap[raw]) {
          pageKey = raw;
        } else if (raw === "shipper_dashboard") {
          pageKey = "shipper_dashboard";
        } else {
          pageKey = "shipper_dashboard";
        }
      }

      if (pageKey && availablePages.includes(pageKey)) {
        loadPage(pageKey);
      } else {
        loadPage("shipper_dashboard");
      }
    });

    // ============================================================
    // INITIAL PAGE LOAD
    // ============================================================

    const path = window.location.pathname;

    const segments = path.split("/").filter((s) => s.length > 0);

    let pageKey = "shipper_dashboard";

    // ------------------------------------------------------------
    // /shipper
    // ------------------------------------------------------------

    if (path === "/shipper" || path === "/shipper/") {
      window.location.replace(`${ROLE_PATH}/shipper_dashboard.html`);

      return;
    }

    // ------------------------------------------------------------
    // /shipper/<page>.html
    // ------------------------------------------------------------

    if (segments.length >= 2 && segments[0] === "shipper") {
      const raw = segments[1].replace(".html", "");

      if (raw === "agreement_details_shipper") {
        pageKey = "agreement_details";
      } else if (pageMap[raw]) {
        pageKey = raw;
      } else if (raw === "shipper_dashboard") {
        pageKey = "shipper_dashboard";
      } else {
        // Unknown shipper page:
        // send to dashboard.

        window.location.replace(`${ROLE_PATH}/shipper_dashboard.html`);

        return;
      }
    }

    // ------------------------------------------------------------
    // OLD DIRECT URL
    //
    // /shipper_dashboard.html
    //
    // Normalize it to:
    //
    // /shipper/shipper_dashboard.html
    // ------------------------------------------------------------
    else if (
      segments.length === 1 &&
      (segments[0] === "shipper_dashboard.html" ||
        segments[0] === "shipper_dashboard")
    ) {
      window.location.replace(`${ROLE_PATH}/shipper_dashboard.html`);

      return;
    }

    // ------------------------------------------------------------
    // Unknown root-level route
    // ------------------------------------------------------------
    else if (segments.length > 0) {
      window.location.replace(`${ROLE_PATH}/shipper_dashboard.html`);

      return;
    }

    // ============================================================
    // FINAL PAGE
    // ============================================================

    const initialPage = availablePages.includes(pageKey)
      ? pageKey
      : "shipper_dashboard";

    await loadPage(initialPage);

    // ============================================================
    // EXPOSE GLOBAL FUNCTIONS
    // ============================================================

    window.loadPage = loadPage;

    window.shipperNavigate = loadPage;
  })();
});
