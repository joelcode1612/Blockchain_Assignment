// ─── SPA ROUTING ──────────────────────────────────────────
(function () {
  const contentEl = document.querySelector(".content");
  const navItems = document.querySelectorAll(".nav-item[href]");

  // ─── Load a page into the content area ──────────────────
  async function loadPage(url) {
    // Show loading
    contentEl.innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-faint);">
        Loading...
      </div>
    `;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract the main content
      const newContent = doc.querySelector(".content");
      if (newContent) {
        contentEl.innerHTML = newContent.innerHTML;
      } else {
        contentEl.innerHTML = doc.body.innerHTML;
      }

      // ─── Update active nav state ──────────────────────
      navItems.forEach((el) => el.classList.remove("active"));
      const activeLink = Array.from(navItems).find(
        (el) => el.getAttribute("href") === url,
      );
      if (activeLink) activeLink.classList.add("active");

      // ─── Update page title ─────────────────────────────
      const title = doc.querySelector("title");
      if (title) document.title = title.textContent;

      // ─── Re‑initialise page‑specific scripts ──────────
      if (typeof window.initPage === "function") {
        window.initPage();
      }
      if (typeof window.initDepositBalance === "function") {
        window.initDepositBalance();
      }
      if (typeof window.initMilestoneRelease === "function") {
        window.initMilestoneRelease();
      }
    } catch (error) {
      console.error("Failed to load page:", error);
      contentEl.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--red);">
          <h3>❌ Failed to load page</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  // ─── Intercept clicks on nav links ──────────────────────
  navItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href && !href.startsWith("http") && !href.startsWith("#")) {
        e.preventDefault();
        loadPage(href);
        window.history.pushState({ page: href }, "", href);
      }
    });
  });

  // ─── Handle browser back/forward ────────────────────────
  window.addEventListener("popstate", function (e) {
    if (e.state && e.state.page) {
      loadPage(e.state.page);
    }
  });

  // ─── Expose loadPage globally ────────────────────────────
  window.loadPage = loadPage;
})();

// ─── SPA ROUTER ──────────────────────────────────────────
(function () {
  const contentEl = document.getElementById("contentPlaceholder");
  const navItems = document.querySelectorAll(".nav-item[data-page]");

  // Map data-page to file path
  const pageMap = {
    dashboard: "shipper.html",
    agreements: "agreements.html",
    create_agreement: "create_agreement.html",
    deposit_balance: "deposit_balance.html",
    milestone_release: "milestone_release.html",
    refund_expiry: "refund_expiry.html",
    history: "../../pages/shared/history.html",
    profile: "shipper_profile.html",
    settings: "settings.html",
  };

  function getPageUrl(pageKey) {
    if (pageKey === "agreement_details") {
      const id =
        new URLSearchParams(window.location.search).get("id") || "AG8901";
      return `agreement_details_shipper.html?id=${id}`;
    }
    return pageMap[pageKey] || "shipper.html";
  }

  async function loadPage(pageKey) {
    const url = getPageUrl(pageKey);

    // ─── LOAD CONTENT ──────────────────────────────────
    contentEl.innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--text-faint);">Loading...</div>';

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const newContent = doc.querySelector(".content");
      if (newContent) {
        contentEl.innerHTML = newContent.innerHTML;
      } else {
        contentEl.innerHTML = doc.body.innerHTML;
      }

      // ─── UPDATE ACTIVE NAV ────────────────────────────
      navItems.forEach((el) => el.classList.remove("active"));
      const active = Array.from(navItems).find(
        (el) => el.dataset.page === pageKey,
      );
      if (active) active.classList.add("active");

      // ─── UPDATE PAGE TITLE ────────────────────────────
      const title = doc.querySelector("title");
      if (title) document.title = title.textContent;

      // ─── RE‑INIT PAGE SCRIPTS ────────────────────────
      if (typeof window.initPage === "function") window.initPage();
      if (typeof window.initDepositBalance === "function")
        window.initDepositBalance();
      if (typeof window.initMilestoneRelease === "function")
        window.initMilestoneRelease();
    } catch (error) {
      console.error("Load error:", error);
      contentEl.innerHTML = `<div style="padding:40px;color:var(--red);">❌ Failed to load page: ${error.message}</div>`;
    }
  }

  // ─── INTERCEPT CLICKS ──────────────────────────────────
  navItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const page = this.dataset.page;
      loadPage(page);
      window.history.pushState({ page }, "", `/${page}`);
    });
  });

  // ─── BACK/FORWARD ──────────────────────────────────────
  window.addEventListener("popstate", function (e) {
    if (e.state && e.state.page) loadPage(e.state.page);
  });

  // ─── LOAD INITIAL PAGE ────────────────────────────────
  const path = window.location.pathname;
  const pageKey = path.split("/").pop() || "dashboard";
  const cleanPage = pageKey.split("?")[0];
  const availablePages = Object.keys(pageMap);
  const initialPage = availablePages.includes(cleanPage)
    ? cleanPage
    : "dashboard";
  loadPage(initialPage);

  // ─── EXPOSE loadPage GLOBALLY ──────────────────────────
  window.loadPage = loadPage;
})();

console.log("Shipper SPA router loaded.");
