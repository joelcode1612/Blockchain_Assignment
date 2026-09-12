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
      // ========================================================
      // 1. VERIFY FULL AUTHENTICATED SESSION
      // ========================================================
      if (window.Auth?.ensureFullSession) {
        const authenticated = await window.Auth.ensureFullSession();
        if (!authenticated) return;
      }

      // ========================================================
      // 2. GET AUTHENTICATED WALLET (blockchain queries only)
      // ========================================================
      const walletAddress = window.Auth?.getWallet?.();
      if (!walletAddress) {
        throw new Error("Authenticated wallet not found.");
      }

      // ========================================================
      // 3. GET AUTHENTICATED ROLE
      // ========================================================
      const role = window.Auth?.getCurrentRole?.();
      if (!role) {
        throw new Error("Authenticated role not found.");
      }

      console.log("🔐 Authenticated wallet:", walletAddress);
      console.log("🔐 Authenticated role:", role);

      let agreements = [];

      // ========================================================
      // 4. SHIPPER — blockchain query uses wallet
      // ========================================================
      if (role === "Shipper") {
        if (typeof window.getAgreementsByShipper !== "function") {
          throw new Error("getAgreementsByShipper not available.");
        }
        agreements = await window.getAgreementsByShipper(walletAddress);
      }

      // ========================================================
      // 5. CARRIER — backend query MUST use JWT
      // ========================================================
      else if (role === "Carrier") {
        const response = await fetch("/api/agreements", {
          method: "GET",
          headers: window.getAuthHeaders(),
        });

        if (!response.ok) {
          let errorMessage = "Failed to fetch agreements.";
          try {
            const err = await response.json();
            errorMessage = err.error || err.message || errorMessage;
          } catch (_) {
            /* ignore invalid JSON */
          }
          throw new Error(errorMessage);
        }
        agreements = await response.json();
      } else {
        throw new Error(`Unknown authenticated role: ${role}`);
      }

      // ========================================================
      // EMPTY STATE
      // ========================================================
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

      // ========================================================
      // STATUS → PILL CLASS
      // ========================================================
      function statusPillClass(status) {
        switch (status) {
          case "Active":
            return "pill lime";
          case "PendingAcceptance":
          case "AwaitingFunding":
            return "pill amber";
          case "Completed":
            return "pill gray";
          case "Expired":
          case "Rejected":
          case "Cancelled":
          case "Refunded":
            return "pill red";
          default:
            return "pill gray";
        }
      }

      // ========================================================
      // BUILD TABLE (now using the classes in styles.css)
      // ========================================================
      const counterpartyHeader = role === "Shipper" ? "Carrier" : "Shipper";

      let rowsHtml = "";

      agreements.forEach((ag) => {
        const id = ag.id || ag.onchain_id || "—";
        const status = ag.statusName || ag.status || "Unknown";

        const valueEth =
          ag.escrowAmountETH ||
          (ag.escrow_amount
            ? parseFloat(ethers.formatEther(String(ag.escrow_amount))).toFixed(
                2,
              )
            : "0.00");

        const deadline = ag.deadline
          ? new Date(
              typeof ag.deadline === "number"
                ? ag.deadline * 1000
                : ag.deadline,
            ).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—";

        // Counterparty display: prefer display_name, fall back to raw wallet
        const rawParty =
          role === "Shipper"
            ? ag.carrier?.display_name ||
              ag.carrier?.wallet_address ||
              ag.carrier ||
              ag.carrier_wallet ||
              "N/A"
            : ag.shipper?.display_name ||
              ag.shipper?.wallet_address ||
              ag.shipper ||
              ag.shipper_wallet ||
              "N/A";

        const partyShort =
          typeof rawParty === "string" && rawParty.length > 14
            ? rawParty.slice(0, 6) + "…" + rawParty.slice(-4)
            : rawParty;

        rowsHtml += `
          <tr>
            <td><span class="agreement-id">#${id}</span></td>
            <td><span class="mono">${partyShort}</span></td>
            <td><span class="agreement-value">${valueEth} ETH</span></td>
            <td>
              <span class="${statusPillClass(status)}">
                <span class="dot"></span>${status}
              </span>
            </td>
            <td>${deadline}</td>
            <td>
              <button
                class="agreement-view-btn view-agreement-btn"
                data-id="${id}"
              >
                View
              </button>
            </td>
          </tr>
        `;
      });

      container.innerHTML = `
        <div class="traxen-agreements">
          <div class="agreements-table-wrap">
            <table class="agreements-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>${counterpartyHeader}</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th style="text-align:center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // ─── View button listeners ──────────────────────────
      document.querySelectorAll(".view-agreement-btn").forEach((btn) => {
        btn.addEventListener("click", function (e) {
          e.preventDefault();

          const agreementId = this.dataset.id;
          const roleNow = window.Auth?.getCurrentRole?.();

          if (!roleNow) {
            console.error("Authenticated role is missing.");
            return;
          }

          if (typeof window.loadPage === "function") {
            window.loadPage("agreement_details");

            const detailPath =
              roleNow === "Shipper"
                ? `/shipper/agreement_details_shipper.html?id=${agreementId}`
                : `/carrier/carrier_agreement_detail.html?id=${agreementId}`;

            window.history.pushState(
              { page: "agreement_details" },
              "",
              detailPath,
            );
          } else {
            const detailFile =
              roleNow === "Shipper"
                ? "agreement_details_shipper.html"
                : "carrier_agreement_detail.html";

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

  // Auto-init if the page is loaded directly (non-SPA fallback)
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
