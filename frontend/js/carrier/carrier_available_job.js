/**
 * ============================================================
 * Carrier Available Jobs – Debug version with verbose logging
 * ============================================================
 */
console.log("✅ carrier_available_jobs.js loaded.");

let availableAgreements = [];

// ─── Fetch available jobs ─────────────────────────────────
async function loadAvailableJobs() {
  console.log("⏳ loadAvailableJobs() called.");

  const container = document.getElementById("available-jobs-list");
  console.log("🔍 container element:", container);

  if (!container) {
    console.error("❌ Container #available-jobs-list not found in DOM!");
    // Show fallback in the .content area (if it exists)
    const content = document.querySelector(".content");
    if (content) {
      content.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--red);">
          <h3>⚠️ UI Error</h3>
          <p>Job list container is missing. Please check your HTML.</p>
        </div>
      `;
    }
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div style="padding: 60px 20px; text-align: center; color: var(--text-faint);">
      <span>⏳ Loading available jobs...</span>
    </div>
  `;

  try {
    const walletAddress = localStorage.getItem("traxenWallet");
    console.log("🔑 Wallet address from localStorage:", walletAddress);

    if (!walletAddress) {
      container.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: var(--red);">
          <h3>🔗 Wallet not connected</h3>
          <p>Please connect your wallet to see available jobs.</p>
        </div>
      `;
      return;
    }

    const url = "/api/agreements/available";
    console.log(`🌐 Fetching ${url}...`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": walletAddress,
      },
    });

    console.log("📡 Response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ API error:", errorData);
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("📦 Received data:", data);

    availableAgreements = data.agreements || [];
    console.log(`📊 Found ${availableAgreements.length} agreements.`);

    if (availableAgreements.length === 0) {
      container.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: var(--text-faint);">
          <h3>📭 No available jobs</h3>
          <p>Check back later – new agreements will appear here.</p>
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
        <p style="margin-top:8px;">${error.message}</p>
        <button onclick="window.initPage()" class="btn btn-primary" style="margin-top: 12px;">
          Retry
        </button>
      </div>
    `;
  }
}

// ─── Render jobs (same as before) ────────────────────────
function renderJobs(container, agreements) {
  console.log("🎨 Rendering jobs...");
  container.innerHTML = "";

  agreements.forEach((agreement) => {
    const card = document.createElement("div");
    card.className = "job-card";
    card.dataset.id = agreement.onchain_id;

    // === DEFINE ALL VARIABLES ===
    const shipper = agreement.shipper?.display_name || "Unknown Shipper";

    let value = "0.00";
    try {
      const wei = agreement.escrow_amount || "0";
      value = parseFloat(ethers.formatEther(String(wei))).toFixed(2);
    } catch (e) {
      console.warn("ETH format error:", e);
    }

    const cargoType = agreement.cargo_type || "Not specified";
    const weight = agreement.weight_kg ? `${agreement.weight_kg} kg` : "";
    const payload = weight ? `${cargoType} (${weight})` : cargoType;

    const deadline = agreement.deadline
      ? new Date(agreement.deadline).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Not set";

    const milestones = agreement.milestones ? agreement.milestones.length : "—";

    // ✅ ADD THIS LINE
    const route =
      agreement.route || `Agreement #${agreement.onchain_id || agreement.id}`;

    // Now use route in the template
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
            <div class="detail-val">${payload}</div>
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
            <div class="detail-val" style="color:var(--lime);">Escrow Funded</div>
          </div>
        </div>
      </div>

      <button class="btn btn-primary btn-block accept-job-btn" data-id="${agreement.onchain_id}">
        Review & Accept Job
      </button>
    `;

    container.appendChild(card);
  });

  document.querySelectorAll(".accept-job-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      const agreementId = this.dataset.id; // now it's the integer onchain_id
      await acceptJob(agreementId);
    });
  });
}

// ─── Accept job (same as before) ─────────────────────────
async function acceptJob(agreementId) {
  try {
    const walletAddress = localStorage.getItem("traxenWallet");
    if (!walletAddress) {
      alert("Please connect your wallet first.");
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

    const response = await fetch(`/api/agreements/${agreementId}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": walletAddress,
      },
      body: JSON.stringify({ acceptTx: tx.hash }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to update agreement status.");
    }

    alert("✅ Job accepted successfully!");
    await loadAvailableJobs();
  } catch (error) {
    console.error("❌ Accept job error:", error);
    alert(`Failed to accept job: ${error.message || "Unknown error"}`);
  }
}

// ─── SPA Router initialisation ──────────────────────────
function initAvailableJobs() {
  console.log("🚀 initAvailableJobs() called (SPA or direct load).");
  loadAvailableJobs();
}

// Expose to SPA router
console.log("📌 Setting window.initPage = initAvailableJobs");
window.initPage = initAvailableJobs;

// Auto-init on direct page load (non‑SPA)
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  console.log("📄 Direct load – DOM ready, calling initAvailableJobs()");
  initAvailableJobs();
} else {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("📄 DOMContentLoaded – calling initAvailableJobs()");
    initAvailableJobs();
  });
}
