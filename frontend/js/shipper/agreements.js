// ─── AGREEMENTS PAGE SCRIPT (Blockchain‑only) ──────────
// This file is loaded by the SPA router when navigating to "agreements".

(function () {
  async function renderAgreements() {
    let container = document.getElementById("agreements-list");
    if (!container) {
      container = document.querySelector(".content");
      if (!container) {
        console.error("Agreements container not found.");
        return;
      }
    }

    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-faint);">
        <span>⏳ Loading your agreements from blockchain...</span>
      </div>
    `;

    try {
      const walletAddress = localStorage.getItem("traxenWallet");
      if (!walletAddress) {
        container.innerHTML = `
          <div style="padding: 60px 20px; text-align: center; color: var(--text-faint);">
            <h3>🔑 Please connect your wallet</h3>
            <p>You need to be logged in to view your agreements.</p>
          </div>
        `;
        return;
      }

      // ─── Fetch from blockchain ──────────────────────────
      if (typeof window.getAgreementsByShipper !== "function") {
        throw new Error(
          "getAgreementsByShipper not available. Is web3_integration loaded?",
        );
      }

      const agreements = await window.getAgreementsByShipper(walletAddress);

      if (!agreements || agreements.length === 0) {
        container.innerHTML = `
          <div style="padding: 60px 20px; text-align: center; color: var(--text-faint);">
            <h3 style="margin-bottom: 8px;">📭 No agreements found</h3>
            <p style="margin-top: 0;">Create your first agreement using the "Create Agreement" button.</p>
          </div>
        `;
        return;
      }

      // ─── Build table ─────────────────────────────────────
      let tableHtml = `
        <div style="overflow-x: auto; margin-top: 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color, #e2e8f0); text-align: left;">
                <th style="padding: 12px 16px;">ID</th>
                <th style="padding: 12px 16px;">Shipper</th>
                <th style="padding: 12px 16px;">Carrier</th>
                <th style="padding: 12px 16px;">Value (ETH)</th>
                <th style="padding: 12px 16px;">Status</th>
                <th style="padding: 12px 16px;">Deadline</th>
                <th style="padding: 12px 16px; text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody>
      `;

      agreements.forEach((ag) => {
        // Map status to badge
        let statusColor = "var(--text-faint, #6b7280)";
        let statusBg = "var(--bg-muted, #f3f4f6)";
        const status = ag.statusName || "Unknown";
        if (status === "Active") {
          statusColor = "#0b6e4f";
          statusBg = "#d1fae5";
        } else if (
          status === "PendingAcceptance" ||
          status === "AwaitingFunding"
        ) {
          statusColor = "#b45309";
          statusBg = "#fef3c7";
        } else if (status === "Completed") {
          statusColor = "#1e40af";
          statusBg = "#dbeafe";
        } else if (
          status === "Expired" ||
          status === "Rejected" ||
          status === "Cancelled"
        ) {
          statusColor = "#991b1b";
          statusBg = "#fee2e2";
        }

        const shipperAddr = ag.shipper || "N/A";
        const carrierAddr = ag.carrier || "N/A";
        const valueEth = ag.escrowAmountETH || "0.00";
        const deadline = ag.deadline
          ? new Date(ag.deadline * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—";

        const agreementId = ag.id || "—";

        tableHtml += `
          <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0);">
            <td style="padding: 12px 16px; font-weight: 500; color: var(--primary, #2563eb);">
              ${agreementId}
            </td>
            <td style="padding: 12px 16px; font-family: monospace; font-size: 0.85rem;">
              ${shipperAddr.slice(0, 6)}…${shipperAddr.slice(-4)}
            </td>
            <td style="padding: 12px 16px; font-family: monospace; font-size: 0.85rem;">
              ${carrierAddr.slice(0, 6)}…${carrierAddr.slice(-4)}
            </td>
            <td style="padding: 12px 16px; font-weight: 500;">${valueEth}</td>
            <td style="padding: 12px 16px;">
              <span style="
                background: ${statusBg};
                color: ${statusColor};
                padding: 4px 12px;
                border-radius: 9999px;
                font-size: 0.8rem;
                font-weight: 600;
                display: inline-block;
              ">
                ${status}
              </span>
            </td>
            <td style="padding: 12px 16px;">${deadline}</td>
            <td style="padding: 12px 16px; text-align: center;">
              <button 
                class="view-agreement-btn" 
                data-id="${agreementId}"
                style="
                  background: var(--primary, #2563eb);
                  color: white;
                  border: none;
                  padding: 6px 14px;
                  border-radius: 6px;
                  font-size: 0.8rem;
                  cursor: pointer;
                  transition: opacity 0.2s;
                "
                onmouseover="this.style.opacity='0.85'"
                onmouseout="this.style.opacity='1'"
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
      `;

      container.innerHTML = tableHtml;

      // ─── View button listeners ──────────────────────────
      document.querySelectorAll(".view-agreement-btn").forEach((btn) => {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          const agreementId = this.dataset.id;
          if (typeof window.loadPage === "function") {
            window.loadPage("agreement_details");
            // ← USE THE CORRECT PATH UNDER /shipper/
            const newUrl = `/shipper/agreement_details_shipper.html?id=${agreementId}`;
            window.history.pushState({ page: "agreement_details" }, "", newUrl);
          } else {
            window.location.href = `agreement_details_shipper.html?id=${agreementId}`;
          }
        });
      });
    } catch (error) {
      console.error("Failed to load agreements:", error);
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--red, #dc2626);">
          <h3>❌ Failed to load agreements</h3>
          <p style="margin-top: 4px;">${error.message}</p>
          <button onclick="window.initAgreements()" class="btn btn-primary" style="margin-top: 12px;">
            Retry
          </button>
        </div>
      `;
    }
  }

  window.initAgreements = renderAgreements;

  // Auto-init if page is loaded directly (non‑SPA fallback)
  if (document.getElementById("agreements-list")) {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      renderAgreements();
    } else {
      document.addEventListener("DOMContentLoaded", renderAgreements);
    }
  }
})();
