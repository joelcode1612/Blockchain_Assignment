// =====================================================
// TAB SWITCHING LOGIC
// =====================================================
function switchCarrierTab(tabId, element) {
  // If it's a real link navigating to another page, let it proceed
  if (element.getAttribute("href") && element.getAttribute("href") !== "#") {
    return true;
  }

  // Prevent default anchor behavior
  if (event) event.preventDefault();

  // 1. Hide all tab views
  document.querySelectorAll(".tab-view").forEach((tab) => {
    tab.classList.remove("active");
  });

  // 2. Remove 'active' class from all sidebar nav items
  document.querySelectorAll(".nav-item").forEach((nav) => {
    nav.classList.remove("active");
  });

  // 3. Show the selected tab
  const selectedTab = document.getElementById(tabId);
  if (selectedTab) selectedTab.classList.add("active");

  // 4. Add 'active' class to the clicked sidebar item
  if (element) element.classList.add("active");

  // 5. Update Header Title based on selection
  const titles = {
    "available-jobs": {
      title: "Available Jobs",
      sub: "Browse and accept decentralized logistics contracts.",
    },
    "my-deliveries": {
      title: "My Deliveries",
      sub: "Track and update your active logistics contracts.",
    },
    "agreement-history": {
      title: "Agreement History",
      sub: "Past contracts and escrow payout logs.",
    },
  };

  if (titles[tabId]) {
    const titleEl = document.getElementById("page-title");
    const subEl = document.getElementById("page-sub");
    if (titleEl) titleEl.innerText = titles[tabId].title;
    if (subEl) subEl.innerText = titles[tabId].sub;
  }
  return false;
}

// =====================================================
// TAB SWITCHING LOGIC (unchanged, keep as is)
// =====================================================
function switchCarrierTab(tabId, element) {
  /* ... existing code ... */
}

// =====================================================
// MAIN – fetch carrier dashboard data
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  const walletAddress = localStorage.getItem("traxenWallet");
  const userRole = localStorage.getItem("traxenUserRole");

  if (!walletAddress) {
    alert("Please log in first.");
    window.location.href = "/login";
    return;
  }

  try {
    // Fetch profile
    const userRes = await fetch("/api/users/me", {
      headers: { "x-wallet-address": walletAddress },
    });
    if (!userRes.ok) throw new Error("Failed to fetch profile");
    const userData = await userRes.json();

    const name =
      userData.display_name ||
      localStorage.getItem("traxenUserName") ||
      "Carrier";
    const role = userData.role || userRole || "Carrier";

    // Update UI elements
    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = `Welcome back, ${name} 🚚`;
    document.querySelector(".mini-name").textContent = name;
    document.querySelector(".mini-role").textContent = role;
    const initials = name.substring(0, 2).toUpperCase();
    document
      .querySelectorAll(".mini-avatar")
      .forEach((el) => (el.textContent = initials));

    // Fetch carrier's active deliveries (agreements where carrier matches)
    const agsRes = await fetch(
      `/api/agreements?carrier_wallet=${walletAddress}`,
    );
    if (!agsRes.ok) throw new Error("Failed to fetch agreements");
    const agreements = await agsRes.json();

    // Update "Active Deliveries" section (job cards)
    const container = document.querySelector(
      ".grid-2col .panel:first-child .job-card",
    )?.parentElement;
    if (container) {
      // Clear existing static cards and render real ones
      container.innerHTML = agreements
        .filter((ag) => ag.status === "active")
        .map(
          (ag) => `
        <div class="job-card clickable" onclick="location.href='agreement-details-carrier.html?id=${ag.onchain_id}'">
          <div class="job-top">
            <div>
              <div class="job-title">#${ag.onchain_id} — ${ag.description || "Agreement"}</div>
              <div class="job-sub">Shipper: ${ag.shipper?.display_name || ag.shipper_wallet?.slice(0, 6) || "Unknown"}</div>
            </div>
            <div class="job-value">${ag.escrow_amount || "0"} ETH</div>
          </div>
          <div class="job-meta">
            <span>Next: <b>${ag.milestones?.find((m) => m.status === "pending")?.description || "No milestones"}</b></span>
            <span>Deadline: <b>${new Date(ag.deadline).toLocaleDateString()}</b></span>
          </div>
          <button class="btn btn-primary" style="width:100%;" onclick="event.stopPropagation();location.href='agreement-details-carrier.html?id=${ag.onchain_id}'">Submit Milestone Proof</button>
        </div>
      `,
        )
        .join("");
    }

    // Also update the "Available Jobs" panel (if you have a separate endpoint)
    // e.g., fetch available agreements (status = pending and not assigned)
    // For brevity, we keep static here.

    // Update stat cards
    const stats = {
      active: agreements.filter((a) => a.status === "active").length,
      totalEarned: agreements.reduce(
        (sum, a) => sum + parseFloat(a.released_amount || 0),
        0,
      ),
      pending: agreements.filter((a) => a.status === "pending").length,
      completed: agreements.filter((a) => a.status === "completed").length,
    };
    // Update the stat values (assuming stat cards have specific classes)
    document.querySelector(".stat-card .val")?.forEach((el, idx) => {
      // Better to use specific selectors; for simplicity we'll assume first stat card is active, etc.
      // You'll need to refine these selectors based on your actual HTML structure.
    });
  } catch (error) {
    console.error("Error loading carrier dashboard:", error);
  }
});
