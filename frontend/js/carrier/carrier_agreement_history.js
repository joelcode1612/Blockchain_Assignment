(function () {
  window.initCarrierAgreements = async function () {
    try {
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      const wallet = localStorage.getItem("traxenWallet");
      if (!wallet) {
        showToast("Wallet not connected.", "warning");
        return;
      }
      
      const token = localStorage.getItem("traxenAuthToken");
      const response = await fetch("/api/agreements", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch agreements");
      }
      let agreements = await response.json();

      // ═══ YON ═══
      // Only concluded agreements belong here (active ones live in
      // My Deliveries). Expired is intentionally excluded — add it to
      // the array below if you want expired agreements shown too.
      const CONCLUDED_STATUSES = ["Completed", "Refunded", "Rejected"];
      agreements = agreements.filter((ag) =>
        CONCLUDED_STATUSES.includes(ag.status)
      );

      // Load REP changes for these agreements from reputation_history.
      const repByAgreement = {};
      try {
        const repRes = await fetch("/api/reputation/history", {
          headers: { "x-wallet-address": wallet },
        });
        if (repRes.ok) {
          const repData = await repRes.json();
          (repData.rewards || []).forEach((r) => {
            if (r.agreement_onchain_id != null) {
              repByAgreement[String(r.agreement_onchain_id)] = Number(r.amount);
            }
          });
        }
      } catch (repError) {
        console.warn("[Yon] reputation history fetch failed:", repError);
      }
      // ═══ YON End ═══

      renderHistory(agreements, repByAgreement);
    } catch (error) {
      console.error("Carrier history error:", error);
      showToast(error.message, "error");
      const tbody = document.getElementById("historyBody");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:40px 0;color:var(--red);">
              ❌ Failed to load history: ${error.message}
            </td>
          </tr>
        `;
      }
    }
  };

  function renderHistory(agreements, repByAgreement) {
    const tbody = document.getElementById("historyBody");
    if (!tbody) return;

    if (!agreements || agreements.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px 0;color:var(--text-faint);">
            <h3>📭 No past agreements</h3>
            <p>You have not completed any deliveries yet.</p>
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    agreements.forEach((ag) => {
      const id = ag.onchain_id || "—";
      const date = ag.updated_at || ag.created_at;
      const completedDate = date ? new Date(date).toLocaleDateString() : "—";
      const shipper =
        ag.shipper?.display_name || ag.shipper_wallet || "Unknown";
      const cargo = ag.cargo_type || "—";
      const amount =
        ag.escrow_amount != null
          ? parseFloat(ethers.formatEther(String(ag.escrow_amount))).toFixed(2)
          : "0.00";
      const status = ag.status || "Unknown";
      const statusBadge =
        status === "Completed"
          ? `<span class="status-badge status-done">✔ Completed</span>`
          : status === "Refunded"
            ? `<span class="status-badge status-refunded">✖ Refunded</span>`
            : status === "Expired"
              ? `<span class="status-badge status-refunded">⚠ Expired</span>`
              : `<span class="status-badge">${status}</span>`;

      // ═══ YON : REP change for this concluded agreement ═══
      // +1 (green) for completed, -5 (red) for refunded, 0 otherwise.
      // A missing row (e.g. reward was capped on-chain) shows as 0.
      const repChange = Number(repByAgreement?.[String(id)] || 0);
      const repCell =
        repChange > 0
          ? `<span style="color:var(--lime);font-weight:600;">+${repChange}</span>`
          : repChange < 0
            ? `<span style="color:var(--red);font-weight:600;">${repChange}</span>`
            : `<span style="color:var(--text-faint);">0</span>`;
      // ═══ YON End ═══

      html += `
        <tr
          onclick="window.location.href='/carrier/carrier_agreement_detail.html?id=${id}'"
          style="cursor:pointer;"
        >
          <td class="mono">#${id}</td>
          <td>${completedDate}</td>
          <td>${shipper}</td>
          <td>${cargo}</td>
          <td class="earned">${amount} ETH</td>
          <td>${repCell}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  function showToast(msg, type) {
    if (typeof window.showToast === "function") {
      window.showToast(msg, type);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  }

  // Auto‑init if loaded directly
  if (document.getElementById("historyBody")) {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      if (typeof window.initCarrierAgreements === "function") {
        window.initCarrierAgreements();
      }
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        if (typeof window.initCarrierAgreements === "function") {
          window.initCarrierAgreements();
        }
      });
    }
  }
})();
