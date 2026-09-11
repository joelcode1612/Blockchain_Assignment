// ─── SHARED AGREEMENTS PAGE ──────────────────────────
// Detects role and fetches agreements accordingly.
function ensureAgreementStyles() {
  if (document.getElementById("traxen-agreements-styles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "traxen-agreements-styles";

  style.textContent = `
    /* =========================================================
       TRAXEN AGREEMENTS - SPA UI
       Scoped only to the agreements page
       ========================================================= */

    #contentPlaceholder .traxen-agreements {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
    }

    #contentPlaceholder .agreements-card {
      width: 100%;
      background: var(--panel);
      border: 1px solid var(--border-soft);
      border-radius: 14px;
      padding: 22px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10);
      overflow: hidden;
    }

    /* ---------- HEADER ---------- */

    #contentPlaceholder .agreements-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;

      margin-bottom: 20px;
      padding-bottom: 16px;

      border-bottom: 1px solid var(--border-soft);
    }

    #contentPlaceholder .agreements-heading h2 {
      margin: 0;

      color: var(--text);

      font-size: 18px;
      font-weight: 750;

      letter-spacing: -0.02em;
    }

    #contentPlaceholder .agreements-heading p {
      margin: 5px 0 0;

      color: var(--text-faint);

      font-size: 12px;
      line-height: 1.5;
    }

    /* ---------- VERIFIED INDICATOR ---------- */

    #contentPlaceholder .agreements-network {
      display: inline-flex;
      align-items: center;
      gap: 7px;

      flex-shrink: 0;

      padding: 6px 11px;

      border-radius: 999px;

      background: var(--lime-glow);

      border: 1px solid rgba(205, 250, 63, 0.25);

      color: var(--lime);

      font-size: 10.5px;
      font-weight: 700;

      white-space: nowrap;
    }

    #contentPlaceholder .agreements-network .dot {
      width: 6px;
      height: 6px;

      border-radius: 50%;

      background: currentColor;
    }

    /* ---------- TABLE CONTAINER ---------- */

    #contentPlaceholder .agreements-table-wrap {
      width: 100%;

      overflow-x: auto;

      background: var(--panel);

      border: 1px solid var(--border-soft);

      border-radius: 12px;

      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.10);
    } 

    #contentPlaceholder .agreements-table {
      width: 100%;
      min-width: 760px;

      border-collapse: separate;
      border-spacing: 0;
    }

    /* ---------- TABLE HEADER ---------- */

    #contentPlaceholder .agreements-table th {
      padding: 12px 14px;

      background: #191c22;

      border-bottom: 1px solid var(--border);

      color: var(--text-faint);

      font-size: 10px;
      font-weight: 700;

      text-align: left;

      text-transform: uppercase;
      letter-spacing: 0.06em;

      white-space: nowrap;
    }

    #contentPlaceholder .agreements-table th:first-child {
      border-radius: 10px 0 0 0;
    }

    #contentPlaceholder .agreements-table th:last-child {
      border-radius: 0 10px 0 0;
    }

    /* ---------- TABLE ROWS ---------- */

    #contentPlaceholder .agreements-table tbody tr {
      transition: background 0.15s ease;
    }

    #contentPlaceholder .agreements-table tbody tr:hover {
      background: rgba(255, 255, 255, 0.025);
    }

    #contentPlaceholder .agreements-table td {
      padding: 15px 14px;

      border-bottom: 1px solid var(--border-soft);

      color: var(--text);

      font-size: 12px;

      vertical-align: middle;
    }

    #contentPlaceholder .agreements-table tbody tr:last-child td {
      border-bottom: none;
    }

    /* ---------- AGREEMENT ID ---------- */

    #contentPlaceholder .agreement-id {
      display: inline-flex;
      align-items: center;

      min-width: 58px;

      padding: 5px 8px;

      background: var(--panel);

      border: 1px solid var(--border);

      border-radius: 7px;

      color: var(--text);

      font-family: var(--mono);

      font-size: 11px;
      font-weight: 700;
    }

    /* ---------- VALUE ---------- */

    #contentPlaceholder .agreement-value {
      color: var(--text);

      font-family: var(--mono);

      font-size: 11.5px;
      font-weight: 700;

      white-space: nowrap;
    }

    /* ---------- STATUS ---------- */

    #contentPlaceholder .agreement-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;

      padding: 5px 9px;

      border-radius: 999px;

      background: var(--panel);

      border: 1px solid var(--border);

      color: var(--text-dim);

      font-size: 10.5px;
      font-weight: 700;

      white-space: nowrap;
    }

    #contentPlaceholder .agreement-status.active {
      background: var(--lime-glow);
      border-color: rgba(205, 250, 63, 0.25);
      color: var(--lime);
    }

    #contentPlaceholder .agreement-status.pending {
      background: var(--amber-glow);
      border-color: rgba(255, 180, 60, 0.25);
      color: var(--amber);
    }

    #contentPlaceholder .agreement-status.completed {
      background: var(--panel-2);
      color: var(--text-dim);
    }

    #contentPlaceholder .agreement-status.cancelled {
      background: var(--red-glow);
      border-color: rgba(255, 92, 92, 0.25);
      color: var(--red);
    }

    #contentPlaceholder .agreement-status .dot {
      width: 5px;
      height: 5px;

      border-radius: 50%;

      background: currentColor;
    }

    /* ---------- BLOCKCHAIN VERIFICATION ---------- */

    #contentPlaceholder .agreement-verified {
      display: inline-flex;
      align-items: center;
      gap: 6px;

      padding: 5px 9px;

      border-radius: 999px;

      background: var(--lime-glow);

      border: 1px solid rgba(205, 250, 63, 0.22);

      color: var(--lime);

      font-size: 10px;
      font-weight: 700;

      white-space: nowrap;
    }

    /* ---------- VIEW BUTTON ---------- */

    #contentPlaceholder .agreement-view-btn {
      min-width: 62px;

      padding: 8px 12px;

      background: transparent;

      border: 1px solid var(--border);

      border-radius: 8px;

      color: var(--text-dim);

      font-size: 11px;
      font-weight: 700;

      cursor: pointer;

      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease;
    }

    #contentPlaceholder .agreement-view-btn:hover {
      background: var(--lime);

      border-color: var(--lime);

      color: #0a0b0d;
    }

    /* ---------- LOADING / EMPTY ---------- */

    #contentPlaceholder .agreements-state {
      display: flex;
      flex-direction: column;

      align-items: center;
      justify-content: center;

      min-height: 180px;

      padding: 30px;

      background: var(--panel-2);

      border: 1px dashed var(--border);

      border-radius: 10px;

      text-align: center;

      color: var(--text-faint);
    }

    #contentPlaceholder .agreements-state h3 {
      margin: 0 0 8px;

      color: var(--text);

      font-size: 15px;
    }

    #contentPlaceholder .agreements-state p {
      margin: 0;

      max-width: 520px;

      font-size: 12px;

      line-height: 1.55;
    }

    /* ---------- RESPONSIVE ---------- */

    @media (max-width: 700px) {
      #contentPlaceholder .agreements-card {
        padding: 16px;
      }

      #contentPlaceholder .agreements-header {
        flex-direction: column;
      }

      #contentPlaceholder .agreements-network {
        align-self: flex-start;
      }
    }
  `;

  document.head.appendChild(style);
}

(function () {
  async function renderAgreements() {
    // ============================================================
    // LOAD AGREEMENT PAGE STYLES
    // ============================================================

    ensureAgreementStyles();

    // ============================================================
    // GET CONTAINER
    // ============================================================

    const container = document.getElementById("agreements-list");

    if (!container) {
      console.warn(
        "⏭️ agreements-list not ready yet. Skipping agreements initialization.",
      );
      return;
    }

    container.innerHTML = `
      <div style="
        padding:40px;
        text-align:center;
        color:var(--text-faint);
      ">
        ⏳ Loading and verifying your agreements...
      </div>
    `;

    try {
      // ============================================================
      // 1. GET JWT
      // ============================================================
      const token =
        typeof window.getAuthToken === "function"
          ? window.getAuthToken()
          : localStorage.getItem("traxenAuthToken");

      if (!token) {
        throw new Error("Authentication token required.");
      }

      // ============================================================
      // 2. GET CURRENT USER
      // ============================================================
      const userResponse = await fetch("/api/users/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Unable to verify authenticated user.");
      }

      const user = await userResponse.json();

      if (!user.wallet_address) {
        throw new Error("Authenticated wallet not found.");
      }

      const userWallet = user.wallet_address.toLowerCase();

      // ============================================================
      // 3. GET AGREEMENTS FROM DATABASE
      // ============================================================
      const response = await fetch("/api/agreements", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));

        throw new Error(
          err.error ||
            err.message ||
            `Failed to fetch agreements (HTTP ${response.status})`,
        );
      }

      const databaseAgreements = await response.json();

      console.log("📦 Agreements loaded from database:", databaseAgreements);

      // ============================================================
      // 4. VERIFY META MASK / NETWORK
      // ============================================================
      if (!window.ethereum) {
        throw new Error("MetaMask is not available.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      const currentChainId = Number(network.chainId);

      // Sepolia
      const EXPECTED_CHAIN_ID = 11155111;

      console.log("🌐 Current chain ID:", currentChainId);

      if (currentChainId !== EXPECTED_CHAIN_ID) {
        throw new Error(
          `Wrong network. Please switch MetaMask to Sepolia (Chain ID: ${EXPECTED_CHAIN_ID}).`,
        );
      }

      // ============================================================
      // 5. VERIFY CURRENT CONTRACT
      // ============================================================
      if (!window.contract) {
        if (typeof window.initContract === "function") {
          await window.initContract();
        }
      }

      const contract = window.contract || window.getContract?.();

      if (!contract) {
        throw new Error("Smart contract is not initialized.");
      }

      console.log("📍 Contract address:", await contract.getAddress());

      // ============================================================
      // 6. VERIFY EACH DATABASE AGREEMENT ON BLOCKCHAIN
      // ============================================================
      const verificationResults = await Promise.all(
        databaseAgreements.map(async (dbAgreement) => {
          const agreementId = Number(dbAgreement.onchain_id);

          if (!Number.isInteger(agreementId) || agreementId <= 0) {
            console.warn(
              "⚠️ Invalid database agreement ID:",
              dbAgreement.onchain_id,
            );

            return null;
          }

          try {
            console.log(
              `🔍 Verifying agreement #${agreementId} on blockchain...`,
            );

            const chainAgreement = await contract.getAgreement(agreementId);

            // ------------------------------------------------------
            // Compare shipper
            // ------------------------------------------------------
            const chainShipper = String(chainAgreement.shipper).toLowerCase();

            if (chainShipper !== userWallet) {
              console.warn(`⚠️ Agreement #${agreementId}: shipper mismatch.`);

              /// Part A fix : these checks used to `return null`, which
              /// silently deleted valid agreements (and blanked the whole page
              /// when every row failed). Keep the row and flag it instead.
              return { ...dbAgreement, blockchain_verified: false };
              /// Part A fix end
            }

            // ------------------------------------------------------
            // Compare carrier
            // ------------------------------------------------------
            const dbCarrier =
              dbAgreement.carrier?.wallet_address ||
              dbAgreement.carrier_wallet ||
              dbAgreement.carrier;

            if (
              dbCarrier &&
              ethers.isAddress(dbCarrier) &&
              chainAgreement.carrier.toLowerCase() !== dbCarrier.toLowerCase()
            ) {
              console.warn(`⚠️ Agreement #${agreementId}: carrier mismatch.`);

              // Part A fix : keep the row, just mark it unverified.
              return { ...dbAgreement, blockchain_verified: false };
            }

            // ------------------------------------------------------
            // Compare escrow amount
            // ------------------------------------------------------
            const dbAmount = String(dbAgreement.escrow_amount || "0");

            if (
              dbAmount !== "0" &&
              chainAgreement.escrowAmount.toString() !== dbAmount
            ) {
              console.warn(
                `⚠️ Agreement #${agreementId}: escrow amount mismatch.`,
              );

              // Part A fix : keep the row, just mark it unverified.
              return { ...dbAgreement, blockchain_verified: false };
            }

            console.log(`✅ Agreement #${agreementId} verified successfully.`);

            return {
              ...dbAgreement,

              blockchain_verified: true,

              blockchain_shipper: chainAgreement.shipper,

              blockchain_carrier: chainAgreement.carrier,

              blockchain_escrow_amount: chainAgreement.escrowAmount.toString(),

              blockchain_deadline: Number(chainAgreement.deadline),

              blockchain_status: Number(chainAgreement.status),
            };
          } catch (chainError) {
            console.warn(
              `⚠️ Agreement #${agreementId} could not be verified on the current network/contract.`,
              chainError.reason || chainError.message,
            );

            // Part A fix : previously returned null, so an RPC hiccup removed
            // the agreement from the UI. Show it unverified instead.
            return { ...dbAgreement, blockchain_verified: false };
          }
        }),
      );

      const verifiedAgreements = verificationResults.filter(Boolean);

      // ============================================================
      // 7. DISPLAY ONLY VERIFIED AGREEMENTS
      // ============================================================
      if (verifiedAgreements.length === 0) {
        container.innerHTML = `
          <div style="
            padding:60px 20px;
            text-align:center;
            color:var(--text-faint);
          ">
            <h3>📭 No verified agreements found</h3>
            <p>
              No database agreement could be verified on the
              current Sepolia blockchain contract.
            </p>
          </div>
        `;

        return;
      }

      // ============================================================
      // 8. BUILD TABLE
      // ============================================================
      let tableHtml = `
  <div class="traxen-agreements">

    <div class="agreements-table-wrap">

      <table class="agreements-table">

        <thead>
          <tr>
            <th>ID</th>
            <th>Carrier</th>
            <th>Value</th>
            <th>Status</th>
            <th>Verification</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
`;

      verifiedAgreements.forEach((agreement) => {
        const id = agreement.onchain_id;

        const carrier =
          agreement.carrier?.display_name ||
          agreement.carrier?.wallet_address ||
          agreement.carrier_wallet ||
          agreement.carrier ||
          "Unknown";

        const amount = agreement.escrow_amount
          ? parseFloat(
              ethers.formatEther(String(agreement.escrow_amount)),
            ).toFixed(4)
          : "0.0000";

        const status = agreement.status || "Unknown";

        let statusClass = "";

        if (status === "Active" || status === "AwaitingFunding") {
          statusClass = "active";
        } else if (status === "PendingAcceptance") {
          statusClass = "pending";
        } else if (status === "Completed") {
          statusClass = "completed";
        } else if (
          status === "Cancelled" ||
          status === "Rejected" ||
          status === "Expired"
        ) {
          statusClass = "cancelled";
        }

        tableHtml += `
    <tr>

      <td>
        <span class="agreement-id">
          #${id}
        </span>
      </td>

      <td>
        ${carrier}
      </td>

      <td>
        <span class="agreement-value">
          ${amount} ETH
        </span>
      </td>

      <td>
        <span class="agreement-status ${statusClass}">
          <span class="dot"></span>
          ${status}
        </span>
      </td>

      <td>
        <span class="agreement-verified">
          ✓ Verified
        </span>
      </td>

      <td>
        <button
          type="button"
          class="agreement-view-btn"
          data-id="${id}"
        >
          View
        </button>
      </td>

    </tr>
  `;
      });
      tableHtml += `
        </tbody>

      </table>

    </div>

  </div>
`;

      container.innerHTML = tableHtml;

      // ============================================================
      // 9. VIEW BUTTONS
      // ============================================================
      container.querySelectorAll(".agreement-view-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          const agreementId = this.dataset.id;

          window.history.pushState(
            { page: "agreement_details" },
            "",
            `/shipper/agreement_details_shipper.html?id=${agreementId}`,
          );

          window.loadPage("agreement_details");
        });
      });
    } catch (error) {
      console.error("❌ Agreement verification failed:", error);

      container.innerHTML = `
        <div style="
          padding:40px;
          text-align:center;
          color:var(--red);
        ">
          <h3>❌ Failed to load agreements</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  window.initAgreements = renderAgreements;
})();
// Inside renderAgreements() after fetching agreements

// ─── Update stats ──────────────────────────────────────
// const completed = agreements.filter((a) => a.status === "Completed");
// const refunded = agreements.filter((a) => a.status === "Refunded");
// const totalEarned = completed.reduce((sum, a) => {
//   const amt = a.escrow_amount
//     ? parseFloat(ethers.formatEther(a.escrow_amount))
//     : 0;
//   return sum + amt;
// }, 0);

// document.getElementById("historyCompleted").textContent = completed.length;
// document.getElementById("historyEarned").textContent =
//   totalEarned.toFixed(2) + " ETH";
// document.getElementById("historyRefunded").textContent = refunded.length;
// document.getElementById("historyAvg").textContent =
//   completed.length > 0
//     ? (totalEarned / completed.length).toFixed(2) + " ETH"
//     : "—";

// Auto-init if the page is loaded directly (non‑SPA fallback)
//   if (document.getElementById("agreements-list")) {
//     if (
//       document.readyState === "complete" ||
//       document.readyState === "interactive"
//     ) {
//       renderAgreements();
//     } else {
//       document.addEventListener("DOMContentLoaded", renderAgreements);
//     }
//   }
// })();
