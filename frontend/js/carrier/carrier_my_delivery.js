// ─── CARRIER MY DELIVERIES ──────────────────────────────
// Loads active agreements from the database.
(function () {
  window.initMyDeliveries = async function () {
    try {
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      const wallet = localStorage.getItem("traxenWallet");
      if (!wallet) {
        showToast("Wallet not connected.", "warning");
        return;
      }

      const response = await fetch("/api/agreements", {
        method: "GET",
        headers: window.getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch agreements");
      }
      const agreements = await response.json();

      // Filter for active deliveries
      const active = agreements.filter(
        (ag) =>
          ag.status === "Active" ||
          ag.status === "AwaitingFunding" ||
          ag.status === "PendingAcceptance",
      );

      renderDeliveries(active);
    } catch (error) {
      console.error("My Deliveries error:", error);
      showToast(error.message, "error");
      const tbody = document.getElementById("deliveries-body");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:40px 0;color:var(--red);">
              ❌ Failed to load deliveries: ${error.message}
            </td>
          </tr>
        `;
      }
    }
  };

  function renderDeliveries(deliveries) {
    const tbody = document.getElementById("deliveries-body");
    if (!tbody) return;

    if (!deliveries || deliveries.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px 0;color:var(--text-faint);">
            <h3>📭 No active deliveries</h3>
            <p style="margin-top:8px;">Browse available jobs to start a new delivery.</p>
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    deliveries.forEach((ag) => {
      const id = ag.onchain_id || "—";
      const name = ag.agreement_name || `Agreement #${id}`;
      const cargo = ag.cargo_type || "General Cargo";
      // Use window.ethers (loaded globally)
      // ═══ YON : wrap escrow_amount in String() — ethers
      // formatEther throws "overflow (INVALID_ARGUMENT)" when given a JS
      // number instead of a string/bigint. ═══
      const escrow = ag.escrow_amount
        ? parseFloat(
            window.ethers.formatEther(String(ag.escrow_amount)),
          ).toFixed(2)
        : "0.00";
      // ═══ YON End ═══
      const deadline = ag.deadline
        ? new Date(ag.deadline).toLocaleDateString()
        : "—";
      const status = ag.status || "Unknown";
      const statusBadge = getStatusBadge(status);
      const nextMilestone = getNextMilestone(ag);
      const actionBtn = getActionButton(ag);

      html += `
        <tr>
          <td class="mono">#${id}</td>
          <td>
            <b>${escapeHtml(name)}</b>
            <br>
            <span class="muted-small">${escapeHtml(cargo)}</span>
          </td>
          <td>${escrow} ETH</td>
          <td>${escapeHtml(nextMilestone)}</td>
          <td>${deadline}</td>
          <td>${statusBadge}</td>
          <td>${actionBtn}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  // ─── Helpers ──────────────────────────────────────────────
  function getStatusBadge(status) {
    let cls = "status-badge";
    let label = status;
    switch (status) {
      case "Active":
        cls += " status-active";
        label = "Active";
        break;
      case "AwaitingFunding":
        cls += " status-action";
        label = "Awaiting Funding";
        break;
      case "PendingAcceptance":
        cls += " status-action";
        label = "Pending Acceptance";
        break;
      case "Completed":
        cls += " status-done";
        label = "Completed";
        break;
      default:
        cls += " status-fail";
        label = status;
    }
    return `<span class="${cls}"><span class="dot"></span>${label}</span>`;
  }

  function getNextMilestone(ag) {
    if (ag.milestones && ag.milestones.length > 0) {
      const sorted = ag.milestones
        .slice()
        .sort((a, b) => a.milestone_index - b.milestone_index);
      const next = sorted.find(
        (m) => m.status !== "Paid" && m.status !== "Verified",
      );
      if (next)
        return next.description || `Milestone ${next.milestone_index + 1}`;
      const allPaid = sorted.every((m) => m.status === "Paid");
      if (allPaid) return "Completed";
      return "In progress";
    }
    return "—";
  }

  function getActionButton(ag) {
    const id = ag.onchain_id;
    if (ag.status === "PendingAcceptance") {
      return `<button class="btn btn-primary btn-sm" onclick="window.loadPage('agreement_details', { id: ${id} })">Accept</button>`;
    }
    return `<button class="btn btn-ghost btn-sm" onclick="window.loadPage('agreement_details', { id: ${id} })">View Details</button>`;
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(msg, type) {
    if (typeof window.showToast === "function") {
      window.showToast(msg, type);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  }

  // ─── Auto-init if loaded directly ────────────────────────
  if (document.getElementById("deliveries-body")) {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      window.initMyDeliveries();
    } else {
      document.addEventListener("DOMContentLoaded", window.initMyDeliveries);
    }
  }
})();
