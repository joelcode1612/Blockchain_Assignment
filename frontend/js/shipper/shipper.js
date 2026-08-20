// ─── SPA ROUTER ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  (function () {
    const contentEl = document.getElementById("contentPlaceholder");
    if (!contentEl) {
      console.error("❌ contentPlaceholder not found. Router cannot start.");
      return;
    }

    const navItems = document.querySelectorAll(".nav-item[data-page]");
    const pageTitleEl = document.getElementById("pageTitle");
    const pageSubEl = document.getElementById("pageSub");
    const topbarActions = document.querySelector(".topbar-actions");

    // ─── PAGE MAPPING ────────────────────────────────────
    const pageMap = {
      agreements: {
        file: "agreements.html",
        title: "Agreements",
        sub: "All logistics agreements you're party to as a Shipper",
        button: { label: "+ Create Agreement", page: "create_agreement" },
      },
      create_agreement: {
        file: "create_agreement.html",
        title: "Create Agreement",
        sub: "Start a new logistics contract with a Carrier",
      },
      deposit_balance: {
        file: "deposit_balance.html",
        title: "Escrow Overview",
        sub: "View your locked and available escrow balances",
      },
      milestone_release: {
        file: "milestone_release.html",
        title: "Milestone Tracking",
        sub: "Track and verify delivery milestones",
      },
      refund_expiry: {
        file: "refund_expiry.html",
        title: "Refund Centre",
        sub: "Manage refunds and expiry of agreements",
      },
      history: {
        file: "../../pages/shared/history.html",
        title: "Transaction History",
        sub: "Complete record of all your transactions",
      },
      profile: {
        file: "shipper_profile.html",
        title: "My Profile",
        sub: "Manage your shipper account and activity",
      },
      settings: {
        file: "settings.html",
        title: "Settings",
        sub: "Configure your account preferences",
      },
    };

    const dashboardTitles = {
      title: "Dashboard",
      sub: "Welcome back!",
    };

    function getPageDetails(pageKey) {
      if (pageKey === "agreement_details") {
        return {
          file: `agreement_details_shipper.html?id=${new URLSearchParams(window.location.search).get("id") || "AG8901"}`,
          title: "Agreement Details",
          sub: "Manage escrow, milestones, and disputes for this agreement",
        };
      }
      return pageMap[pageKey] || null;
    }

    // ─── TOPBAR BUTTON ──────────────────────────────────
    let topbarButtonElement = null;

    function updateTopbarButton(pageKey) {
      if (topbarButtonElement) {
        topbarButtonElement.remove();
        topbarButtonElement = null;
      }
      const details = getPageDetails(pageKey);
      if (details && details.button) {
        const btn = document.createElement("button");
        btn.className = "btn btn-primary";
        btn.textContent = details.button.label;
        btn.onclick = function () {
          window.loadPage(details.button.page);
        };
        topbarActions.appendChild(btn);
        topbarButtonElement = btn;
      }
    }

    // ─── DASHBOARD HTML ──────────────────────────────────
    function getDashboardHTML() {
      return `
      <div class="view active">
        <!-- Stats Row -->
        <div class="stat-row">
          <div class="stat-card">
            <div class="lbl">Total Agreements</div>
            <div class="val lime" id="stat-total">0</div>
            <div class="delta" id="stat-total-delta">Loading...</div>
          </div>
          <div class="stat-card">
            <div class="lbl">Active</div>
            <div class="val" id="stat-active">0</div>
            <div class="delta">In progress</div>
          </div>
          <div class="stat-card">
            <div class="lbl">Completed</div>
            <div class="val" id="stat-completed">0</div>
            <div class="delta">✅ On time</div>
          </div>
          <div class="stat-card">
            <div class="lbl">Total Escrow (ETH)</div>
            <div class="val amber" id="stat-escrow">0.00</div>
            <div class="delta">Locked in contracts</div>
          </div>
        </div>

        <!-- Two‑column layout -->
        <div class="two-col">
          <div class="panel">
            <h2>Recent Agreements</h2>
            <div class="desc">Your latest logistics contracts</div>
            <div id="recent-agreements-list"><div style="padding:20px;text-align:center;color:var(--text-faint);">Loading...</div></div>
            <div style="margin-top:14px;">
              <button class="btn btn-ghost" onclick="window.loadPage('agreements')">View All →</button>
            </div>
          </div>
          <div class="panel">
            <h2>Quick Actions</h2>
            <div class="desc">What would you like to do?</div>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
              <button class="btn btn-primary btn-block" onclick="window.loadPage('create_agreement')">+ Create New Agreement</button>
              <button class="btn btn-ghost btn-block" onclick="window.loadPage('deposit_balance')">💰 View Escrow Balances</button>
              <button class="btn btn-ghost btn-block" onclick="window.loadPage('milestone_release')">📍 Track Milestones</button>
            </div>
            <hr style="border-color:var(--border-soft); margin:18px 0;">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-faint);">
                <span>Next Milestone Due</span>
                <span style="color:var(--amber);" id="next-milestone-days">--</span>
              </div>
              <div class="progress-track"><div class="progress-fill" id="milestone-progress" style="width:0%;"></div></div>
              <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-faint);">
                <span>Pickup ✓</span><span>In Transit</span><span>Out for Delivery</span><span>Delivered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    }

    // ─── Load dashboard stats ──────────────────────────────
    async function loadDashboardStats() {
      try {
        const walletAddress = localStorage.getItem("traxenWallet");
        if (!walletAddress) {
          console.warn("No wallet address for dashboard stats.");
          return;
        }
        const response = await fetch("/api/agreements", {
          headers: { "x-wallet-address": walletAddress },
        });
        if (!response.ok) throw new Error("Failed to fetch agreements");
        const agreements = await response.json();

        const total = agreements.length;
        const active = agreements.filter(a => a.status === "Active" || a.status === "AwaitingFunding").length;
        const completed = agreements.filter(a => a.status === "Completed").length;
        let totalEscrow = 0;
        agreements.forEach(a => {
          try {
            const wei = a.escrow_amount ? String(a.escrow_amount) : "0";
            const eth = parseFloat(ethers.formatEther(wei));
            if (!isNaN(eth)) totalEscrow += eth;
          } catch (e) { /* ignore */ }
        });

        document.getElementById("stat-total").textContent = total;
        document.getElementById("stat-active").textContent = active;
        document.getElementById("stat-completed").textContent = completed;
        document.getElementById("stat-escrow").textContent = totalEscrow.toFixed(2);
        document.getElementById("stat-total-delta").textContent =
          total > 0 ? `${total} agreement${total > 1 ? "s" : ""}` : "No agreements yet";

        const recentContainer = document.getElementById("recent-agreements-list");
        const recent = agreements.slice(-3).reverse();
        if (recent.length === 0) {
          recentContainer.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-faint);">No agreements yet. Create one!</div>`;
        } else {
          let html = `<table><thead><tr><th>ID</th><th>Carrier</th><th>Status</th><th>Value</th></tr></thead><tbody>`;
          recent.forEach(a => {
            const status = a.status || "Unknown";
            let pillClass = "pill gray";
            if (status === "Active" || status === "AwaitingFunding") pillClass = "pill lime";
            else if (status === "PendingAcceptance") pillClass = "pill amber";
            else if (status === "Completed") pillClass = "pill gray";
            const value = a.escrow_amount ? parseFloat(ethers.formatEther(a.escrow_amount)).toFixed(2) : "0.00";
            const carrierName = a.carrier?.display_name || a.carrier?.wallet_address || "Unknown";
            html += `<tr>
              <td><span class="mono">#${a.onchain_id || "—"}</span></td>
              <td>${carrierName}</td>
              <td><span class="${pillClass}"><span class="dot"></span>${status}</span></td>
              <td>${value} ETH</td>
            </tr>`;
          });
          html += `</tbody></table>`;
          recentContainer.innerHTML = html;
        }

        const activeAgreement = agreements.find(a => a.status === "Active" || a.status === "AwaitingFunding");
        if (activeAgreement?.milestones?.length > 0) {
          const totalMilestones = activeAgreement.milestones.length;
          const paid = activeAgreement.milestones.filter(m => m.status === "Paid").length;
          const progress = totalMilestones > 0 ? (paid / totalMilestones) * 100 : 0;
          document.getElementById("milestone-progress").style.width = progress + "%";
          document.getElementById("next-milestone-days").textContent = "3 days";
        } else {
          document.getElementById("next-milestone-days").textContent = "No active agreement";
          document.getElementById("milestone-progress").style.width = "0%";
        }
      } catch (error) {
        console.error("Dashboard stats error:", error);
        if (typeof showToast === "function") showToast("Failed to load dashboard data", "error");
      }
    }

    // ─── SILENT CONTRACT RESTORATION (no pop‑up) ──────────
    async function restoreContractFromSession() {
      if (window.contract) return window.contract;
      if (!window.ethereum) {
        console.warn('MetaMask not available.');
        return null;
      }

      // Try to get the already connected account – silent, no pop‑up.
      let accounts;
      try {
        accounts = await window.ethereum.request({ method: 'eth_accounts' });
      } catch (e) {
        console.warn('eth_accounts failed:', e);
        return null;
      }

      if (!accounts || accounts.length === 0) {
        console.warn('No connected account found. User must connect manually.');
        return null;
      }

      // We have an account – rebuild the contract silently.
      try {
        const config = window.__CONFIG;
        if (!config) {
          console.error('__CONFIG not set – ensure web3_integration exposes it.');
          return null;
        }

        let abi;
        if (typeof window.__loadContractABI === 'function') {
          abi = await window.__loadContractABI();
        } else {
          const res = await fetch(config.abiPath);
          if (!res.ok) throw new Error('ABI fetch failed');
          const artifact = await res.json();
          abi = artifact.abi;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(); // silent – already connected
        const contract = new ethers.Contract(config.contractAddress, abi, signer);
        window.contract = contract;
        window.userWalletAddress = accounts[0];
        console.log('✅ Contract restored silently from session.');
        return contract;
      } catch (e) {
        console.error('Failed to restore contract:', e);
        return null;
      }
    }

    // ─── Ensure contract is available (no auto‑connect) ──
    async function ensureContract() {
      if (window.contract) return true;
      const restored = await restoreContractFromSession();
      if (restored) return true;
      // If we couldn't restore silently, we do NOT call connectWallet().
      // Instead, we log and let the user connect manually.
      console.warn('No contract available – please connect your wallet manually.');
      if (typeof showToast === 'function') {
        showToast('Please connect your wallet to use blockchain features.', 'info');
      }
      return false;
    }

    // ─── Load a page ────────────────────────────────────────
    async function loadPage(pageKey) {
      if (pageKey === "dashboard") {
        contentEl.innerHTML = getDashboardHTML();
        updateTopbarButton(null);
        navItems.forEach(el => el.classList.remove("active"));
        const active = Array.from(navItems).find(el => el.dataset.page === "dashboard");
        if (active) active.classList.add("active");
        if (pageTitleEl) pageTitleEl.textContent = dashboardTitles.title;
        if (pageSubEl) pageSubEl.textContent = dashboardTitles.sub;
        await loadDashboardStats();
        await ensureContract(); // silent attempt
        return;
      }

      const details = getPageDetails(pageKey);
      if (!details) {
        contentEl.innerHTML = `<div style="padding:40px;color:var(--red);">❌ Page not found: ${pageKey}</div>`;
        return;
      }

      const url = details.file;
      contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-faint);">Loading...</div>';

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const newContent = doc.querySelector(".content");
        contentEl.innerHTML = newContent ? newContent.innerHTML : doc.body.innerHTML;

        navItems.forEach(el => el.classList.remove("active"));
        const active = Array.from(navItems).find(el => el.dataset.page === pageKey);
        if (active) active.classList.add("active");

        if (pageTitleEl) pageTitleEl.textContent = details.title;
        if (pageSubEl) pageSubEl.textContent = details.sub;
        document.title = `Traxen — ${details.title}`;

        updateTopbarButton(pageKey);

        const pageInits = {
          agreements: "initAgreements",
          create_agreement: "initCreateAgreement",
          deposit_balance: "initDepositBalance",
          milestone_release: "initMilestoneRelease",
          refund_expiry: "initRefundExpiry",
          history: "initHistory",
          profile: "initProfile",
          settings: "initSettings",
          agreement_details: "initAgreementDetails",
        };
        const initName = pageInits[pageKey];
        if (initName && typeof window[initName] === "function") {
          window[initName]();
        }

        await ensureContract(); // silent attempt
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
    const availablePages = ["dashboard", ...Object.keys(pageMap)];
    const initialPage = availablePages.includes(cleanPage) ? cleanPage : "dashboard";
    loadPage(initialPage);

    // ─── Auto‑restore contract on full reload (silent) ──
    if (window.Auth?.getWallet?.()) {
      (async function() {
        if (!window.contract) {
          await restoreContractFromSession(); // silent – no pop‑up
        }
      })();
    }

    // ─── EXPOSE loadPage GLOBALLY ──────────────────────────
    window.loadPage = loadPage;
  })();
});
console.log("Shipper SPA router loaded.");