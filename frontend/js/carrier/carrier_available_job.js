/**
 * ============================================================
 * Carrier Available Jobs – Blockchain only
 * ============================================================
 */
console.log("✅ carrier_available_jobs.js loaded.");

let availableAgreements = [];

// ─── Fetch available jobs from blockchain ─────────────────
async function loadAvailableJobs() {
  console.log("⏳ loadAvailableJobs() called.");

  const container = document.getElementById("available-jobs-list");
  if (!container) {
    console.error("❌ Container #available-jobs-list not found.");
    return;
  }

  container.innerHTML = `
    <div style="padding: 60px 20px; text-align: center; color: var(--text-faint);">
      <span>⏳ Loading available jobs from blockchain...</span>
    </div>
  `;

  try {
    const walletAddress = localStorage.getItem("traxenWallet");
    if (!walletAddress) {
      container.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: var(--red);">
          <h3>🔗 Wallet not connected</h3>
          <p>Please connect your wallet to see available jobs.</p>
        </div>
      `;
      return;
    }

    if (typeof window.getPendingAgreementsForCarrier !== "function") {
      throw new Error(
        "getPendingAgreementsForCarrier not available. Is web3_integration loaded?",
      );
    }

    const pending = await window.getPendingAgreementsForCarrier(walletAddress);
    console.log("📦 Pending agreements:", pending);
    availableAgreements = pending;

    if (availableAgreements.length === 0) {
      container.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: var(--text-faint);">
          <h3>📭 No available jobs</h3>
          <p>You have no pending agreements to accept at the moment.</p>
        </div>
      `;
      return;
    }

    renderJobs(container, availableAgreements);
  } catch (error) {
    console.error("❌ Failed to load jobs:", error);
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--red);">
        <h3>❌ Failed to load jobs</h3>
        <p>${error.message}</p>
        <button onclick="window.initAvailableJobs()" class="btn btn-primary" style="margin-top: 12px;">
          Retry
        </button>
      </div>
    `;
  }
}

// ─── Render jobs ──────────────────────────────────────────
function renderJobs(container, agreements) {
  container.innerHTML = "";
  agreements.forEach((ag) => {
    const card = document.createElement("div");
    card.className = "job-card";
    card.dataset.id = ag.id;

    const shipper = ag.shipper
      ? `${ag.shipper.slice(0, 6)}…${ag.shipper.slice(-4)}`
      : "Unknown Shipper";
    const value = ag.escrowAmountETH || "0.00";
    const deadline = ag.deadline
      ? new Date(ag.deadline * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      : "Not set";
    const milestones = ag.milestoneCount || "—";
    const route = `Agreement #${ag.id}`;

    card.innerHTML = `
      <div>
        <div class="job-header">
          <div>
            <div class="job-route">${route}</div>
            <div class="job-shipper">Shipper: ${shipper}</div>
          </div>
          <div class="job-value">
            <div class="job-eth">${value} ETH</div>
          </div>
        </div>

        <div class="job-details">
          <div>
            <div class="detail-label">Payload</div>
            <div class="detail-val">—</div>
          </div>
          <div>
            <div class="detail-label">Deadline</div>
            <div class="detail-val">${deadline}</div>
          </div>
          <div>
            <div class="detail-label">Milestones</div>
            <div class="detail-val">${milestones} Checkpoints</div>
          </div>
          <div>
            <div class="detail-label">Status</div>
            <div class="detail-val" style="color:var(--lime);">Pending Acceptance</div>
          </div>
        </div>
      </div>

      <button class="btn btn-primary btn-block accept-job-btn" data-id="${ag.id}">
        Review & Accept Job
      </button>
    `;

    container.appendChild(card);
  });

  // ─── Accept button listeners ──────────────────────────
  document.querySelectorAll(".accept-job-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      const agreementId = this.dataset.id;
      await acceptJob(agreementId);
    });
  });
}

// ─── Accept job (blockchain only) ──────────────────────────
async function acceptJob(agreementId) {
  try {
    const walletAddress = localStorage.getItem("traxenWallet");
    if (!walletAddress) {
      showToast("Please connect your wallet first.", "warning");
      return;
    }

    if (
      !confirm(`Are you sure you want to accept agreement #${agreementId}?`)
    ) {
      return;
    }

    if (typeof acceptAgreement !== "function") {
      throw new Error("Blockchain accept function not available.");
    }

    const tx = await acceptAgreement(agreementId);
    console.log("✅ Blockchain acceptance tx:", tx);
    showToast("✅ Job accepted successfully!", "success");

    // Refresh the list
    await loadAvailableJobs();
  } catch (error) {
    console.error("❌ Accept job error:", error);
    showToast(
      `Failed to accept job: ${error.message || "Unknown error"}`,
      "error",
    );
  }
}

// ─── Toast helper ──────────────────────────────────────────
function showToast(message, type = "info") {
  console.log(`[${type}] ${message}`);
}

// ─── SPA Router initialisation ──────────────────────────
function initAvailableJobs() {
  console.log("🚀 initAvailableJobs() called.");
  loadAvailableJobs();
}

// Expose for the router
window.initAvailableJobs = initAvailableJobs;

// Auto-init on direct page load
if (document.getElementById("available-jobs-list")) {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    initAvailableJobs();
  } else {
    document.addEventListener("DOMContentLoaded", initAvailableJobs);
  }
}
