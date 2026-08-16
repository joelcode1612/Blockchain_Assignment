document.addEventListener("DOMContentLoaded", async () => {
  const walletAddress = localStorage.getItem("traxenWallet");
  const userRole = localStorage.getItem("traxenUserRole");

  if (!walletAddress) {
    alert("Please log in first.");
    window.location.href = "/login";
    return;
  }

  try {
    // Fetch user profile
    const userRes = await fetch("/api/users/me", {
      headers: { "x-wallet-address": walletAddress },
    });
    if (!userRes.ok) throw new Error("Failed to fetch profile");
    const userData = await userRes.json();

    const name =
      userData.display_name ||
      localStorage.getItem("traxenUserName") ||
      "Shipper";
    const role = userData.role || userRole || "Shipper";

    // Update UI
    document.querySelector("h1").textContent = `Welcome back, ${name} 👋`;
    document.querySelector(".mini-name").textContent = name;
    document.querySelector(".mini-role").textContent = role;
    const initials = name.substring(0, 2).toUpperCase();
    document
      .querySelectorAll(".mini-avatar")
      .forEach((el) => (el.textContent = initials));

    // Update stats (could also come from backend)
    // For now, we keep static stats, but you could fetch stats from /api/users/stats

    // Fetch agreements for the table
    const agsRes = await fetch(
      `/api/agreements?shipper_wallet=${walletAddress}`,
    );
    if (!agsRes.ok) throw new Error("Failed to fetch agreements");
    const agreements = await agsRes.json();

    // Render agreements into the table
    const tbody = document.querySelector("tbody");
    if (tbody) {
      tbody.innerHTML = agreements
        .map(
          (ag) => `
        <tr class="clickable" onclick="location.href='agreement_details_shipper.html?id=${ag.onchain_id}'">
          <td>#${ag.onchain_id} — ${ag.description || "Agreement"}</td>
          <td>${ag.carrier?.display_name || ag.carrier_wallet?.slice(0, 6) || "Unknown"}</td>
          <td>${ag.escrow_amount || "0"} ETH</td>
          <td>${ag.milestones?.filter((m) => m.status === "verified").length || 0}/${ag.milestones?.length || 0} milestones</td>
          <td>${new Date(ag.deadline).toLocaleString()}</td>
          <td><span class="pill ${ag.status === "active" ? "lime" : ag.status === "pending" ? "amber" : "gray"}"><span class="dot"></span>${ag.status || "Pending"}</span></td>
        </tr>
      `,
        )
        .join("");
    }
  } catch (error) {
    console.error("Error loading dashboard:", error);
  }
});

(function() {
  const contentEl = document.querySelector('.content');
  const navItems = document.querySelectorAll('.nav-item[href]');

  // ─── Load a page into the content area ──────────────────
  async function loadPage(url) {
    // Show loading indicator
    contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-faint);">Loading...</div>';

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract the main content (assuming it's inside <div class="content">)
      const newContent = doc.querySelector('.content');
      if (newContent) {
        contentEl.innerHTML = newContent.innerHTML;
      } else {
        // fallback: take the entire body
        contentEl.innerHTML = doc.body.innerHTML;
      }

      // ─── Update active nav state ──────────────────────
      navItems.forEach(el => el.classList.remove('active'));
      const activeLink = Array.from(navItems).find(el => el.getAttribute('href') === url);
      if (activeLink) activeLink.classList.add('active');

      // ─── Update page title ─────────────────────────────
      const title = doc.querySelector('title');
      if (title) document.title = title.textContent;

      // ─── Re‑initialise page‑specific scripts ──────────
      // If the loaded page exposes an `initPage` function, call it.
      // This allows each page to re‑attach event listeners and fetch data.
      if (typeof window.initPage === 'function') {
        window.initPage();
      }

      // Also check for a page‑specific init (e.g., window.initDepositBalance)
      if (typeof window.initDepositBalance === 'function') {
        window.initDepositBalance();
      }
      if (typeof window.initMilestoneRelease === 'function') {
        window.initMilestoneRelease();
      }
      // Add more as needed.

    } catch (error) {
      console.error('Failed to load page:', error);
      contentEl.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--red);">
          <h3>❌ Failed to load page</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  // ─── Intercept clicks on nav links ──────────────────────
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      // Intercept internal links only (relative paths, not external or #)
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        e.preventDefault();
        loadPage(href);
        // Update browser URL without reloading
        window.history.pushState({ page: href }, '', href);
      }
    });
  });

  // ─── Handle browser back/forward ────────────────────────
  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.page) {
      loadPage(e.state.page);
    }
  });

  // ─── Expose loadPage globally for inline use ────────────
  window.loadPage = loadPage;

})();

// ─── (Optional) Your existing shipper dashboard logic ──────
// e.g., handle logout, profile dropdowns, etc.
console.log('Shipper dashboard loaded.');