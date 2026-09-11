let currentFilter = "all";
let allAgreements = [];

async function fetchAgreements() {
  const walletAddress = localStorage.getItem("traxenWallet");
  if (!walletAddress) {
    document.getElementById("agreement-list").innerHTML = `
            <div class="card empty-state"><p>Please connect your wallet to see agreements.</p></div>
        `;
    return;
  }

  try {
    const token = localStorage.getItem("traxenAuthToken");
    const response = await fetch("/api/agreements", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch agreements");
    allAgreements = await response.json();
    renderAgreements();
  } catch (error) {
    console.error("Error fetching agreements:", error);
    document.getElementById("agreement-list").innerHTML = `
            <div class="card empty-state"><p>❌ Could not load agreements. Please try again.</p></div>
        `;
  }
}

function renderAgreements() {
  const container = document.getElementById("agreement-list");
  if (!container) return;

  const list = allAgreements.filter((ag) => {
    if (currentFilter === "all") return true;
    return ag.status === currentFilter;
  });

  if (list.length === 0) {
    container.innerHTML = `<div class="card empty-state"><p>No agreements found for "${currentFilter}".</p></div>`;
    return;
  }

  container.innerHTML = list
    .map(
      (ag) => `
        <div class="card agreement-card" data-id="${ag.onchain_id}" onclick="window.location.href='/agreement_details_shipper.html?id=${ag.onchain_id}'">
            <div class="card-header">
                <span class="ag-id">AGR-${String(ag.onchain_id).padStart(4, "0")}</span>
                <span class="pill pill-${ag.status}">${(ag.status || "pending").toUpperCase()}</span>
            </div>
            <div class="card-body">
                <div class="ag-details">
                    <span>Shipper: ${truncateAddress(ag.shipper_wallet)}</span>
                    <span>Carrier: ${truncateAddress(ag.carrier_wallet)}</span>
                    <span>Amount: ${ag.escrow_amount || "0"} ETH</span>
                </div>
                <div class="progress-wrapper">
                    <div class="progress-track">
                        <div class="progress-fill" style="width:${ag.progress || 0}%"></div>
                    </div>
                    <span class="progress-label">${ag.progress || 0}%</span>
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}

function filterAgreements(filter) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  renderAgreements();
}

function truncateAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => filterAgreements(btn.dataset.filter));
  });
  // Also listen for wallet connection event
  window.addEventListener("walletConnected", fetchAgreements);
  fetchAgreements();
});
