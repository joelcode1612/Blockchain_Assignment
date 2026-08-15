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
