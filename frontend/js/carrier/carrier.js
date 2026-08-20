// ============================================================
// CARRIER SPA ROUTER
// ============================================================
(function () {
  const contentEl = document.getElementById("contentPlaceholder");
  const navItems = document.querySelectorAll(".nav-item[data-page]");
  const pageTitleEl = document.getElementById("pageTitle");
  const pageSubEl = document.getElementById("pageSub");

  const pageMap = {
    "available-jobs": {
      file: "carrier_available_job.html",
      title: "Available Jobs",
      sub: "Browse and accept decentralized logistics contracts.",
    },
    agreements: {
      file: "carrier_agreement_history.html",
      title: "Agreement History",
      sub: "Past contracts and escrow payout logs.",
    },
    "my-deliveries": {
      file: "carrier_my_delivery.html",
      title: "My Deliveries",
      sub: "Track and update your active logistics contracts.",
    },
    milestone_release: {
      file: "milestone_release.html",
      title: "Milestone Tracking",
      sub: "Submit and verify delivery milestones.",
    },
    history: {
      file: "../../pages/shared/history.html",
      title: "Transaction History",
      sub: "Complete record of all your transactions.",
    },
    profile: {
      file: "carrier_profile.html",
      title: "My Profile",
      sub: "Manage your carrier account and delivery performance.",
    },
  };

  const dashboardTitles = {
    title: "Dashboard",
    sub: "Here's what's happening with your deliveries",
  };

  // Preserve the inline dashboard markup so it can be restored on back-nav.
  const dashboardHTML = contentEl ? contentEl.innerHTML : "";

  // ─── After injecting new content ──────────────────────────
  if (typeof window.initPage === "function") {
    window.initPage();
  }

  // ─── Set active nav state ────────────────────────────────
  function setActiveNav(pageKey) {
    navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.page === pageKey);
    });
  }

  // ─── Set page title / subtitle ────────────────────────────
  function setTitles(title, sub) {
    if (pageTitleEl) pageTitleEl.textContent = title;
    if (pageSubEl) pageSubEl.textContent = sub;
  }

  // ─── Load a page into the content area ────────────────────
  async function loadPage(pageKey) {
    if (!Auth || !Auth.requireRoleForUrl("/carrier/")) return;

    setActiveNav(pageKey);

    if (pageKey === "dashboard") {
      setTitles(dashboardTitles.title, dashboardTitles.sub);
      contentEl.innerHTML = dashboardHTML;
      if (typeof window.initPage === "function") {
        window.initPage();
      }
      await loadDashboard();
      // 🟢 Validate session after dashboard loads
      if (window.Auth && typeof window.Auth.ensureFullSession === 'function') {
        window.Auth.ensureFullSession();
      }
      return;
    }

    const cfg = pageMap[pageKey];
    if (!cfg) {
      setTitles(dashboardTitles.title, dashboardTitles.sub);
      await loadDashboard();
      return;
    }

    setTitles(cfg.title, cfg.sub);
    contentEl.innerHTML = `
    <div style="padding:40px;text-align:center;color:var(--text-faint);">
      Loading...
    </div>
  `;

    try {
      const response = await fetch(cfg.file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const newContent = doc.querySelector(".content");
      contentEl.innerHTML = newContent
        ? newContent.innerHTML
        : doc.body.innerHTML;

      if (typeof window.initPage === "function") {
        window.initPage();
      }

      // 🟢 Validate session after loading any page
      if (window.Auth && typeof window.Auth.ensureFullSession === 'function') {
        window.Auth.ensureFullSession();
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

  // ─── Render the dashboard (inline content + data) ─────────
  async function loadDashboard() {
    // Default dashboard markup is already inside #contentPlaceholder.
    // Re-render it in case the user navigated away.
    const view = document.querySelector(".view");
    if (!view) return;

    const walletAddress = localStorage.getItem("traxenWallet");
    if (!walletAddress) return;

    try {
      const agsRes = await fetch(
        `/api/agreements?carrier_wallet=${walletAddress}`,
        {
          headers: { "x-wallet-address": walletAddress },
        },
      );
      if (!agsRes.ok) throw new Error("Failed to fetch agreements");
      const agreements = await agsRes.json();

      const active = agreements.filter(
        (ag) =>
          ag.status === "Active" ||
          ag.status === "AwaitingFunding" ||
          ag.status === "PendingAcceptance",
      );
      const available = agreements.filter(
        (ag) => ag.status === "PendingAcceptance",
      );

      const statActive = document.getElementById("stat-active");
      if (statActive) statActive.textContent = active.length;

      const earned = agreements
        .filter((ag) => ag.status === "Active" || ag.status === "Completed")
        .reduce((sum, ag) => sum + (Number(ag.total_amount_eth) || 0), 0);
      const statEarned = document.getElementById("stat-earned");
      if (statEarned) statEarned.textContent = `${earned.toFixed(2)} ETH`;

      const completed = agreements.filter(
        (ag) => ag.status === "Completed",
      ).length;
      const statCompleted = document.getElementById("stat-completed");
      if (statCompleted) statCompleted.textContent = completed;

      const deliveryEl = document.getElementById("active-deliveries");
      if (deliveryEl) {
        deliveryEl.innerHTML =
          active.length === 0
            ? `<div style="color:var(--text-faint);padding:12px 0;">No active deliveries yet.</div>`
            : active
                .map(
                  (ag) => `
            <div class="job-card clickable" onclick="location.href='agreement_details_carrier.html?id=${ag.onchain_id}'">
              <div class="job-top">
                <div>
                  <div class="job-title">#${ag.onchain_id} — ${ag.agreement_name || "Agreement"}</div>
                  <div class="job-sub">Shipper: ${ag.shipper || "Unknown"}</div>
                </div>
                <div class="job-value">${ag.total_amount_eth || "0"} ETH</div>
              </div>
              <div class="job-meta">
                <span>Next: <b>${ag.status}</b></span>
                <span>Deadline: <b>${ag.deadline ? new Date(ag.deadline).toLocaleDateString() : "—"}</b></span>
              </div>
              <button class="btn btn-primary" style="width:100%;" onclick="event.stopPropagation();location.href='agreement_details_carrier.html?id=${ag.onchain_id}'">View Agreement</button>
            </div>
          `,
                )
                .join("");
      }

      const availEl = document.getElementById("available-jobs");
      if (availEl) {
        availEl.innerHTML =
          available.length === 0
            ? `<div style="color:var(--text-faint);padding:12px 0;">No available jobs right now.</div>`
            : available
                .map(
                  (ag) => `
            <div class="job-card clickable" onclick="location.href='agreement_pending.html?id=${ag.onchain_id}'">
              <div class="job-top">
                <div>
                  <div class="job-title">${ag.agreement_name || "Agreement"}</div>
                  <div class="job-sub">Shipper: ${ag.shipper || "Unknown"}</div>
                </div>
                <div class="job-value">${ag.total_amount_eth || "0"} ETH</div>
              </div>
              <div class="job-meta"><span>${ag.milestone_count || 0} milestones</span><span>Deadline: <b>${ag.deadline ? new Date(ag.deadline).toLocaleDateString() : "—"}</b></span></div>
              <button class="btn btn-ghost" style="width:100%;" onclick="event.stopPropagation();location.href='agreement_pending.html?id=${ag.onchain_id}'">View &amp; Accept</button>
            </div>
          `,
                )
                .join("");
      }
    } catch (error) {
      console.error("Error loading carrier dashboard:", error);
    }
  }

  // ─── Intercept clicks on nav items ────────────────────────
  navItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      loadPage(this.dataset.page);
      window.history.pushState(
        { page: this.dataset.page },
        "",
        `?page=${this.dataset.page}`,
      );
    });
  });

  // ─── Handle browser back/forward ──────────────────────────
  window.addEventListener("popstate", function (e) {
    if (e.state && e.state.page) loadPage(e.state.page);
  });

  // ─── Load initial page from URL ───────────────────────────
  const initial =
    new URLSearchParams(window.location.search).get("page") || "dashboard";

  // ─── Fill user info into sidebar ──────────────────────────
  async function fillUserInfo() {
    const walletAddress = localStorage.getItem("traxenWallet");
    if (!walletAddress) return;

    try {
      const userRes = await fetch("/api/users/me", {
        headers: { "x-wallet-address": walletAddress },
      });
      if (!userRes.ok) return;
      const userData = await userRes.json();
      const name =
        userData.display_name ||
        localStorage.getItem("traxenUserName") ||
        "Carrier";
      const role =
        userData.role || localStorage.getItem("traxenUserRole") || "Carrier";

      const miniName = document.querySelector(".mini-name");
      if (miniName) miniName.textContent = name;
      const miniRole = document.querySelector(".mini-role");
      if (miniRole) miniRole.textContent = role;
      const initials = name.substring(0, 2).toUpperCase();
      document
        .querySelectorAll(".mini-avatar")
        .forEach((el) => (el.textContent = initials));
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const walletAddress = localStorage.getItem("traxenWallet");
    if (!walletAddress) {
      // 🟢 Use Auth.ensureFullSession to handle missing session
      if (window.Auth && typeof window.Auth.ensureFullSession === 'function') {
        window.Auth.ensureFullSession();
      } else {
        window.location.href = "/login";
      }
      return;
    }
    await fillUserInfo();
    await loadPage(initial);
    // 🟢 Validate session after the initial page load
    if (window.Auth && typeof window.Auth.ensureFullSession === 'function') {
      window.Auth.ensureFullSession();
    }
  });

  // ─── Expose for inline onclick handlers ───────────────────
  window.carrierNavigate = loadPage;
})();