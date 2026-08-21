// ─── SHARED AGREEMENTS PAGE ──────────────────────────
// Detects role and fetches agreements accordingly.

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
        <span>⏳ Loading your agreements...</span>
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

      // ─── Determine role ──────────────────────────────────
      const role = localStorage.getItem("traxenRole") || "Shipper";

      let agreements = [];

      if (role === "Shipper") {
        // Shipper: fetch from blockchain
        if (typeof window.getAgreementsByShipper !== "function") {
          throw new Error("getAgreementsByShipper not available.");
        }
        agreements = await window.getAgreementsByShipper(walletAddress);
      } else if (role === "Carrier") {
        // Carrier: fetch from API
        const response = await fetch("/api/agreements", {
          headers: { "x-wallet-address": walletAddress },
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to fetch agreements");
        }
        agreements = await response.json();
      } else {
        throw new Error("Unknown role: " + role);
      }

      if (!agreements || agreements.length === 0) {
        const msg =
          role === "Shipper"
            ? "Create your first agreement using the 'Create Agreement' button."
            : "No past contracts yet. Accept a job to get started.";
        container.innerHTML = `
          <div style="padding: 60px 20px; text-align: center; color: var(--text-faint);">
            <h3 style="margin-bottom: 8px;">📭 No agreements found</h3>
            <p style="margin-top: 0;">${msg}</p>
          </div>
        `;
        return;
      }

      // ─── Build table ─────────────────────────────────────
      // (The table logic is the same, but we need to adapt the data shape)
      let tableHtml = `
        <div style="overflow-x: auto; margin-top: 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color, #e2e8f0); text-align: left;">
                <th style="padding: 12px 16px;">ID</th>
                <th style="padding: 12px 16px;">${role === "Shipper" ? "Carrier" : "Shipper"}</th>
                <th style="padding: 12px 16px;">Value (ETH)</th>
                <th style="padding: 12px 16px;">Status</th>
                <th style="padding: 12px 16px;">Deadline</th>
                <th style="padding: 12px 16px; text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody>
      `;

      agreements.forEach((ag) => {
        // Normalize data (handle both blockchain and API shapes)
        const id = ag.id || ag.onchain_id || "—";
        const status = ag.statusName || ag.status || "Unknown";
        const valueEth =
          ag.escrowAmountETH ||
          (ag.escrow_amount
            ? parseFloat(ethers.formatEther(ag.escrow_amount)).toFixed(2)
            : "0.00");
        const deadline = ag.deadline
          ? new Date(ag.deadline * 1000 || ag.deadline).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" },
            )
          : "—";
        const counterparty =
          role === "Shipper" ? ag.carrier || "N/A" : ag.shipper || "N/A";
        // For carrier API response, we might have nested objects
        const partyName =
          role === "Shipper"
            ? ag.carrier || "N/A"
            : ag.shipper?.display_name || ag.shipper_wallet || "N/A";

        // Status badge color
        let statusColor = "var(--text-faint, #6b7280)";
        let statusBg = "var(--bg-muted, #f3f4f6)";
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

        const agreementId = id;
        tableHtml += `
          <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0);">
            <td style="padding: 12px 16px; font-weight: 500; color: var(--primary, #2563eb);">
              ${agreementId}
            </td>
            <td style="padding: 12px 16px; font-family: monospace; font-size: 0.85rem;">
              ${typeof partyName === "string" && partyName.length > 10 ? partyName.slice(0, 6) + "…" + partyName.slice(-4) : partyName}
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
          const role = localStorage.getItem("traxenRole") || "Shipper";
          if (typeof window.loadPage === "function") {
            window.loadPage("agreement_details");
            // Build correct detail URL based on role
            const detailPath =
              role === "Shipper"
                ? `/shipper/agreement_details_shipper.html?id=${agreementId}`
                : `/carrier/agreement_details_carrier.html?id=${agreementId}`;
            window.history.pushState(
              { page: "agreement_details" },
              "",
              detailPath,
            );
          } else {
            // fallback
            const detailFile =
              role === "Shipper"
                ? "agreement_details_shipper.html"
                : "agreement_details_carrier.html";
            window.location.href = `${detailFile}?id=${agreementId}`;
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
