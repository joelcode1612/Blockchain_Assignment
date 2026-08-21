// ─── CARRIER SPA ROUTER ─────────────────────────────────
(function () {
  const ROLE_PATH = "/carrier";

  document.addEventListener("DOMContentLoaded", function () {
    (async function () {
      const contentEl = document.getElementById("contentPlaceholder");
      if (!contentEl) {
        console.error("❌ contentPlaceholder not found.");
        return;
      }

      // ─── SESSION GUARD ──────────────────────────────────────
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return; // redirect already happened

      // ─── UPDATE SIDEBAR ──────────────────────────────────
      await fillUserInfo();

      const navItems = document.querySelectorAll(".nav-item[data-page]");
      const pageTitleEl = document.getElementById("pageTitle");
      const pageSubEl = document.getElementById("pageSub");

      // ─── PAGE MAPPING (all fragments served from /fragments) ──
      const pageMap = {
        carrier_available_jobs: {
          file: "/fragments/carrier/carrier_available_job.html",
          title: "Available Jobs",
          sub: "Browse and accept decentralized logistics contracts.",
        },
        carrier_agreements: {
          file: "/fragments/carrier/carrier_agreement_history.html",
          title: "Agreement History",
          sub: "Past contracts and escrow payout logs.",
        },
        carrier_my_deliveries: {
          file: "/fragments/carrier/carrier_my_delivery.html",
          title: "My Deliveries",
          sub: "Track and update your active logistics contracts.",
        },
        carrier_milestone_release: {
          file: "/fragments/carrier/milestone_release.html",
          title: "Milestone Tracking",
          sub: "Submit and verify delivery milestones.",
        },
        carrier_history: {
          file: "/fragments/shared/history.html",
          title: "Transaction History",
          sub: "Complete record of all your transactions.",
        },
        carrier_profile: {
          file: "/fragments/carrier/carrier_profile.html",
          title: "My Profile",
          sub: "Manage your carrier account and delivery performance.",
        },
      };

      function getPageDetails(pageKey) {
        if (pageKey === "agreement_details") {
          const id =
            new URLSearchParams(window.location.search).get("id") || "AG8901";
          return {
            file: `/fragments/carrier/carrier_agreement_detail.html?id=${id}`,
            title: "Agreement Details",
            sub: "Manage this delivery contract",
          };
        }
        return pageMap[pageKey] || null;
      }

      // ─── DASHBOARD HTML (inline) ────────────────────────────
      function getDashboardHTML() {
        return `
          <div class="view active">
            <!-- Stats -->
            <div class="stat-row">
              <div class="stat-card">
                <div class="lbl">Active Deliveries</div>
                <div class="val" id="stat-active">—</div>
                <div class="delta up">↑ Updated live</div>
              </div>
              <div class="stat-card">
                <div class="lbl">Total Earned</div>
                <div class="val lime" id="stat-earned">— ETH</div>
                <div class="delta">Released across milestones</div>
              </div>
              <div class="stat-card">
                <div class="lbl">Pending Milestones</div>
                <div class="val" id="stat-pending">—</div>
                <div class="delta">Awaiting verification</div>
              </div>
              <div class="stat-card">
                <div class="lbl">Completed Deliveries</div>
                <div class="val" id="stat-completed">—</div>
                <div class="delta up">On-time performance</div>
              </div>
            </div>

            <!-- CTA -->
            <div class="cta-banner">
              <div>
                <h3>New jobs are waiting</h3>
                <p>Browse open agreements from verified shippers and lock in your next delivery.</p>
              </div>
              <button class="btn btn-primary" onclick="window.loadPage('available-jobs')">Browse Available Jobs</button>
            </div>

            <!-- My Deliveries + Available Jobs -->
            <div class="grid-2col" style="grid-template-columns:1fr 1fr;">
              <div class="panel">
                <div class="panel-head">
                  <h2>My Active Deliveries</h2>
                  <button class="btn btn-ghost" onclick="window.loadPage('my-deliveries')">View All</button>
                </div>
                <div id="active-deliveries">
                  <div style="color:var(--text-faint);padding:12px 0;">Loading deliveries...</div>
                </div>
              </div>

              <div class="panel">
                <div class="panel-head">
                  <h2>Available Jobs Nearby</h2>
                  <button class="btn btn-ghost" onclick="window.loadPage('available-jobs')">Browse All</button>
                </div>
                <div id="available-jobs">
                  <div style="color:var(--text-faint);padding:12px 0;">Loading available jobs...</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // ─── Load dashboard stats ──────────────────────────────
      async function loadDashboardStats() {
        const walletAddress =
          window.Session?.getWalletAddress?.() ||
          localStorage.getItem("traxenWallet");
        if (!walletAddress) return;

        try {
          const response = await fetch("/api/agreements", {
            headers: { "x-wallet-address": walletAddress.trim().toLowerCase() },
          });
          if (!response.ok) throw new Error("Failed to fetch agreements");
          const agreements = await response.json();

          const active = agreements.filter(
            (ag) =>
              ag.status === "Active" ||
              ag.status === "AwaitingFunding" ||
              ag.status === "PendingAcceptance",
          );
          const pending = agreements.filter(
            (ag) => ag.status === "PendingAcceptance",
          );
          const completed = agreements.filter(
            (ag) => ag.status === "Completed",
          );

          document.getElementById("stat-active").textContent = active.length;
          document.getElementById("stat-completed").textContent =
            completed.length;
          document.getElementById("stat-pending").textContent = pending.length;

          const earned = agreements
            .filter((ag) => ag.status === "Active" || ag.status === "Completed")
            .reduce((sum, ag) => sum + (Number(ag.total_amount_eth) || 0), 0);
          document.getElementById("stat-earned").textContent =
            `${earned.toFixed(2)} ETH`;

          // Active deliveries
          const deliveryEl = document.getElementById("active-deliveries");
          if (deliveryEl) {
            if (active.length === 0) {
              deliveryEl.innerHTML = `<div style="color:var(--text-faint);padding:12px 0;">No active deliveries yet.</div>`;
            } else {
              deliveryEl.innerHTML = active
                .map(
                  (ag) => `
                    <div class="job-card clickable" onclick="window.loadPage('agreement_details', { id: ${ag.onchain_id} })">
                      <div class="job-top">
                        <div>
                          <div class="job-title">#${ag.onchain_id} — ${ag.agreement_name || "Agreement"}</div>
                          <div class="job-sub">Shipper: ${ag.shipper?.display_name || ag.shipper_wallet || "Unknown"}</div>
                        </div>
                        <div class="job-value">${ag.total_amount_eth || "0"} ETH</div>
                      </div>
                      <div class="job-meta">
                        <span>Next: <b>${ag.status}</b></span>
                        <span>Deadline: <b>${ag.deadline ? new Date(ag.deadline).toLocaleDateString() : "—"}</b></span>
                      </div>
                      <button class="btn btn-primary" style="width:100%;" onclick="event.stopPropagation();window.loadPage('agreement_details', { id: ${ag.onchain_id} })">View Agreement</button>
                    </div>
                  `,
                )
                .join("");
            }
          }

          // Available jobs
          const availEl = document.getElementById("available-jobs");
          if (availEl) {
            const available = agreements.filter(
              (ag) => ag.status === "PendingAcceptance",
            );
            if (available.length === 0) {
              availEl.innerHTML = `<div style="color:var(--text-faint);padding:12px 0;">No available jobs right now.</div>`;
            } else {
              availEl.innerHTML = available
                .map(
                  (ag) => `
                    <div class="job-card clickable" onclick="window.loadPage('agreement_details', { id: ${ag.onchain_id} })">
                      <div class="job-top">
                        <div>
                          <div class="job-title">${ag.agreement_name || "Agreement"}</div>
                          <div class="job-sub">Shipper: ${ag.shipper?.display_name || ag.shipper_wallet || "Unknown"}</div>
                        </div>
                        <div class="job-value">${ag.total_amount_eth || "0"} ETH</div>
                      </div>
                      <div class="job-meta"><span>${ag.milestone_count || 0} milestones</span><span>Deadline: <b>${ag.deadline ? new Date(ag.deadline).toLocaleDateString() : "—"}</b></span></div>
                      <button class="btn btn-ghost" style="width:100%;" onclick="event.stopPropagation();window.loadPage('agreement_details', { id: ${ag.onchain_id} })">View &amp; Accept</button>
                    </div>
                  `,
                )
                .join("");
            }
          }
        } catch (error) {
          console.error("Dashboard stats error:", error);
          if (typeof showToast === "function")
            showToast("Failed to load dashboard data", "error");
        }
      }

      // ─── Update sidebar user info ──────────────────────────
      function updateSidebar(name, role) {
        const miniName = document.querySelector(".mini-name");
        const miniRole = document.querySelector(".mini-role");
        const miniAvatar = document.querySelectorAll(".mini-avatar");
        if (miniName) miniName.textContent = name;
        if (miniRole) miniRole.textContent = role;
        const initials = name.substring(0, 2).toUpperCase();
        miniAvatar.forEach((el) => (el.textContent = initials));
      }

      async function fillUserInfo() {
        if (window.Session) {
          const session = window.Session.getSession();
          const name =
            session.name || session.wallet?.slice(0, 6) + "..." || "Carrier";
          const role = session.role || "Carrier";
          updateSidebar(name, role);
          return;
        }
        const wallet = localStorage.getItem("traxenWallet");
        if (!wallet) return;
        try {
          const res = await fetch("/api/users/me", {
            headers: { "x-wallet-address": wallet },
          });
          if (res.ok) {
            const user = await res.json();
            updateSidebar(
              user.display_name || "Carrier",
              user.role || "Carrier",
            );
          }
        } catch (e) {
          console.warn("Could not fetch user info", e);
        }
      }

      // ─── Load a page ──────────────────────────────────────────
      async function loadPage(pageKey, params = {}) {
        // ─── Guard ──────────────────────────────────────────────
        const sessionOk = await window.Auth.ensureFullSession();
        if (!sessionOk) return;

        // Map "dashboard" from nav to "carrier_dashboard"
        if (pageKey === "dashboard") pageKey = "carrier_dashboard";

        if (params.id) {
          const url = new URL(window.location);
          url.searchParams.set("id", params.id);
          window.history.replaceState(
            { page: pageKey },
            "",
            url.pathname + url.search,
          );
        }

        setActiveNav(pageKey);

        if (pageKey === "carrier_dashboard") {
          setTitles(
            "Dashboard",
            "Here's what's happening with your deliveries",
          );
          contentEl.innerHTML = getDashboardHTML();
          await loadDashboardStats();
          return;
        }

        const details = getPageDetails(pageKey);
        if (!details) {
          contentEl.innerHTML = `<div style="padding:40px;color:var(--red);">❌ Page not found</div>`;
          return;
        }

        setTitles(details.title, details.sub);
        contentEl.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-faint);">Loading...</div>`;

        try {
          const response = await fetch(details.file);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const newContent = doc.querySelector(".content");
          contentEl.innerHTML = newContent
            ? newContent.innerHTML
            : doc.body.innerHTML;

          const pageInits = {
            carrier_available_jobs: "initAvailableJobs",
            carrier_agreements: "initCarrierAgreements",
            carrier_my_deliveries: "initMyDeliveries",
            carrier_milestone_release: "initMilestoneRelease",
            carrier_history: "initHistory",
            carrier_profile: "initCarrierProfile",
            agreement_details: "initAgreementDetails",
          };
          const initFn = pageInits[pageKey];
          if (initFn && typeof window[initFn] === "function") {
            window[initFn]();
          }
        } catch (error) {
          console.error("Load error:", error);
          contentEl.innerHTML = `<div style="padding:40px;color:var(--red);">❌ Failed to load page: ${error.message}</div>`;
        }
      }

      // ─── Set active nav ──────────────────────────────────────
      function setActiveNav(pageKey) {
        navItems.forEach((item) => {
          item.classList.toggle("active", item.dataset.page === pageKey);
        });
      }

      function setTitles(title, sub) {
        if (pageTitleEl) pageTitleEl.textContent = title;
        if (pageSubEl) pageSubEl.textContent = sub;
      }

      // ─── Intercept nav clicks ──────────────────────────────
      navItems.forEach((item) => {
        item.addEventListener("click", function (e) {
          e.preventDefault();
          const page = this.dataset.page;
          loadPage(page);
          window.history.pushState({ page }, "", `${ROLE_PATH}/${page}.html`);
        });
      });

      // ─── Back/forward ──────────────────────────────────────
      const availablePages = [
        "carrier_dashboard",
        ...Object.keys(pageMap),
        "agreement_details",
      ];

      window.addEventListener("popstate", function (e) {
        if (e.state && e.state.page) {
          loadPage(e.state.page);
        } else {
          const path = window.location.pathname;
          const segments = path.split("/").filter((s) => s.length > 0);
          let pageKey = "carrier_dashboard";
          if (segments.length >= 2 && segments[0] === "carrier") {
            const raw = segments[1].replace(".html", "");
            if (raw === "carrier_agreement_detail")
              pageKey = "agreement_details";
            else if (pageMap[raw]) pageKey = raw;
            else pageKey = "carrier_dashboard";
          }
          if (pageKey && availablePages.includes(pageKey)) {
            loadPage(pageKey);
          } else {
            loadPage("carrier_dashboard");
          }
        }
      });

      // ─── INITIAL PAGE LOAD ──────────────────────────────────
      const path = window.location.pathname;
      const segments = path.split("/").filter((s) => s.length > 0);
      let pageKey = "carrier_dashboard";
      if (segments.length >= 2 && segments[0] === "carrier") {
        const raw = segments[1].replace(".html", "");
        if (raw === "carrier_agreement_detail") pageKey = "agreement_details";
        else if (pageMap[raw]) pageKey = raw;
        else pageKey = "carrier_dashboard";
      } else {
        window.location.href = `${ROLE_PATH}/carrier_dashboard.html`;
        return;
      }
      if (!pageKey) pageKey = "carrier_dashboard";
      const initialPage = availablePages.includes(pageKey)
        ? pageKey
        : "carrier_dashboard";
      loadPage(initialPage);

      // ─── Expose loadPage globally ──────────────────────────
      window.loadPage = loadPage;
      window.carrierNavigate = loadPage;
    })();
  });
})();
