// ─── Transaction History ──────────────────────────────────
console.log("🚀 history.js loaded");

(function () {
  let currentAgreementId = null;
  let allAgreements = [];

  function log(msg) {
    const el = document.getElementById("output");
    if (el) {
      el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
    }
  }

  // ============================================================
  // GET AUTHENTICATED WALLET
  // Wallet is still useful for blockchain operations.
  // It is NOT used as backend API authentication anymore.
  // ============================================================

  function getWalletAddress() {
    if (window.userWalletAddress) {
      return window.userWalletAddress.toLowerCase();
    }

    if (typeof window.Auth?.getWallet === "function") {
      const wallet = window.Auth.getWallet();

      if (wallet) {
        return wallet.toLowerCase();
      }
    }

    const stored = localStorage.getItem("traxenWallet");

    if (stored) {
      return stored.toLowerCase();
    }

    return null;
  }

  // ============================================================
  // GET AUTHENTICATED ROLE
  // ============================================================

  function getCurrentRole() {
    if (typeof window.Auth?.getCurrentRole === "function") {
      return window.Auth.getCurrentRole();
    }

    return localStorage.getItem("traxenUserRole") || "Shipper";
  }

  // ============================================================
  // FRONTEND BACKUP FILTER
  // ============================================================

  function filterPaymentsForRole(payments, role) {
    if (!payments || payments.length === 0) {
      return payments;
    }

    if (role && role.toLowerCase() === "carrier") {
      return payments.filter(
        (payment) => !payment.type || !payment.type.includes("Deposit"),
      );
    }

    return payments;
  }

  // ============================================================
  // LOAD AGREEMENTS
  // PROTECTED API → JWT
  // ============================================================

  async function loadAgreements() {
    try {
      // --------------------------------------------------------
      // 1. Verify complete authenticated session
      // --------------------------------------------------------

      if (window.Auth?.ensureFullSession) {
        const authenticated = await window.Auth.ensureFullSession();

        if (!authenticated) {
          return;
        }
      }

      // --------------------------------------------------------
      // 2. Get wallet
      // --------------------------------------------------------

      const address = getWalletAddress();

      if (!address) {
        console.warn("No wallet address");
        return;
      }

      // --------------------------------------------------------
      // 3. Protected backend API
      // IMPORTANT:
      // Use Bearer JWT instead of x-wallet-address
      // --------------------------------------------------------

      const res = await fetch("/api/agreements", {
        method: "GET",
        headers: window.getAuthHeaders(),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;

        try {
          const errorData = await res.json();

          message = errorData.error || errorData.message || message;
        } catch (_) {
          // Ignore invalid JSON response.
        }

        throw new Error(message);
      }

      allAgreements = await res.json();

      console.log("✅ Agreements loaded:", allAgreements);

      // --------------------------------------------------------
      // 4. Populate agreement dropdown
      // --------------------------------------------------------

      const sel = document.getElementById("agreementSelect");

      if (!sel) {
        return;
      }

      sel.innerHTML = '<option value="">— Select —</option>';

      allAgreements.forEach((ag) => {
        const opt = document.createElement("option");

        opt.value = ag.onchain_id;

        opt.textContent =
          `AGR-${String(ag.onchain_id).padStart(4, "0")} ` + `(${ag.status})`;

        sel.appendChild(opt);
      });

      // --------------------------------------------------------
      // 5. Automatically load first agreement / all
      // --------------------------------------------------------

      const toggle = document.getElementById("showAllToggle");

      if (allAgreements.length > 0 && toggle && !toggle.checked) {
        sel.value = allAgreements[0].onchain_id;

        await loadHistory();
      } else if (allAgreements.length > 0 && toggle && toggle.checked) {
        await loadHistory();
      } else {
        const content = document.getElementById("historyContent");

        if (content) {
          content.innerHTML =
            '<div style="color:var(--text-faint);padding:12px 0;">' +
            "No agreements found." +
            "</div>";
        }

        clearStats();
      }
    } catch (e) {
      console.error("Load agreements error:", e);

      log("❌ Failed to load agreements: " + e.message);
    }
  }

  // ============================================================
  // LOAD HISTORY
  // PROTECTED API → JWT
  // ============================================================

  async function loadHistory() {
    // --------------------------------------------------------
    // 1. Verify complete authenticated session
    // --------------------------------------------------------

    if (window.Auth?.ensureFullSession) {
      const authenticated = await window.Auth.ensureFullSession();

      if (!authenticated) {
        return;
      }
    }

    const sel = document.getElementById("agreementSelect");

    const toggle = document.getElementById("showAllToggle");

    const showAll = toggle ? toggle.checked : true;

    const container = document.getElementById("historyContent");

    const desc = document.getElementById("historyDesc");

    const role = getCurrentRole();

    const roleParam = role ? role.toLowerCase() : "";

    let url;

    // ========================================================
    // ALL HISTORY
    // ========================================================

    if (showAll) {
      url =
        `/api/history` +
        (roleParam ? `?role=${encodeURIComponent(roleParam)}` : "");

      if (desc) {
        desc.textContent =
          roleParam === "carrier"
            ? "All payment releases you have received"
            : "All transactions across all your agreements";
      }

      if (sel) {
        sel.disabled = false;
        sel.style.opacity = "1";
      }
    }

    // ========================================================
    // SINGLE AGREEMENT HISTORY
    // ========================================================
    else {
      const id = parseInt(sel ? sel.value : "");

      currentAgreementId = isNaN(id) ? null : id;

      if (currentAgreementId === null) {
        if (container) {
          container.innerHTML =
            '<div style="color:var(--text-faint);padding:12px 0;">' +
            "Select an agreement to view transactions." +
            "</div>";
        }

        clearStats();
        return;
      }

      url =
        `/api/history/${currentAgreementId}` +
        (roleParam ? `?role=${encodeURIComponent(roleParam)}` : "");

      if (desc) {
        desc.textContent = `Transactions for AGR-${String(
          currentAgreementId,
        ).padStart(4, "0")}`;
      }

      if (sel) {
        sel.disabled = false;
        sel.style.opacity = "1";
      }
    }

    try {
      // ========================================================
      // PROTECTED API → JWT
      // ========================================================

      const res = await fetch(url, {
        method: "GET",
        headers: window.getAuthHeaders(),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;

        try {
          const errorData = await res.json();

          message = errorData.error || errorData.message || message;
        } catch (_) {
          // Ignore invalid JSON response.
        }

        throw new Error(message);
      }

      const data = await res.json();

      const payments = data.payments || [];

      // Additional frontend filter
      const filtered = filterPaymentsForRole(payments, role);

      renderHistory(filtered);
      updateStats(filtered);

      log(`✅ Loaded history (${showAll ? "all" : "selected"}) for ${role}`);
    } catch (e) {
      console.error("Load history error:", e);

      if (container) {
        container.innerHTML = `<div style="color:var(--text-faint);padding:12px 0;">
            ❌ ${e.message}
          </div>`;
      }

      clearStats();
    }
  }

  // ============================================================
  // RENDER HISTORY
  // ============================================================

  function renderHistory(payments) {
    const container = document.getElementById("historyContent");

    if (!container) {
      return;
    }

    if (!payments || payments.length === 0) {
      container.innerHTML =
        '<div style="color:var(--text-faint);padding:12px 0;">' +
        "📭 No transactions found." +
        "</div>";

      return;
    }

    const rows = payments
      .map((p) => {
        const amount =
          p.amountEth ||
          (p.amount != null ? ethers.formatEther(String(p.amount)) : "—");

        const type = p.type || "Event";

        const txHash = p.txHash || "—";

        const time = p.timestamp || "—";

        const status = p.status || "completed";

        const statusClass = status === "completed" ? "lime" : "amber";

        const shortHash =
          txHash.length > 12
            ? `${txHash.slice(0, 6)}…${txHash.slice(-4)}`
            : txHash;

        const agreementLabel = p.agreementId
          ? `AGR-${String(p.agreementId).padStart(4, "0")}`
          : "";

        return `
          <tr>
            <td>
              ${type}
              ${agreementLabel ? ` (${agreementLabel})` : ""}
            </td>

            <td>
              ${amount} ETH
            </td>

            <td class="mono">
              ${shortHash}
            </td>

            <td>
              ${time ? new Date(time).toLocaleString() : "—"}
            </td>

            <td>
              <span class="pill ${statusClass}">
                <span class="dot"></span>
                ${status}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            <th>Tx Hash</th>
            <th>Timestamp</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  // ============================================================
  // UPDATE STATS
  // ============================================================

  function updateStats(payments) {
    const totalPaymentsEl = document.getElementById("totalPayments");

    const totalEthEl = document.getElementById("totalEth");

    const latestPaymentEl = document.getElementById("latestPayment");

    const agreementIdDisplayEl = document.getElementById("agreementIdDisplay");

    if (
      !totalPaymentsEl ||
      !totalEthEl ||
      !latestPaymentEl ||
      !agreementIdDisplayEl
    ) {
      console.warn("Stats elements not found – skipping update.");

      return;
    }

    const total = payments.length;

    const totalEth = payments.reduce((sum, p) => {
      const amt =
        p.amountEth ||
        (p.amount != null ? ethers.formatEther(String(p.amount)) : "0");

      return sum + parseFloat(amt);
    }, 0);

    const latest = payments.length > 0 ? payments[0] : null;

    totalPaymentsEl.textContent = total;

    totalEthEl.textContent = totalEth.toFixed(4) + " ETH";

    latestPaymentEl.textContent = latest
      ? latest.timestamp
        ? new Date(latest.timestamp).toLocaleString()
        : "—"
      : "—";

    const toggle = document.getElementById("showAllToggle");

    const showAll = toggle ? toggle.checked : true;

    if (showAll) {
      agreementIdDisplayEl.textContent = "All";
    } else {
      agreementIdDisplayEl.textContent =
        currentAgreementId !== null
          ? `AGR-${String(currentAgreementId).padStart(4, "0")}`
          : "—";
    }
  }

  // ============================================================
  // CLEAR STATS
  // ============================================================

  function clearStats() {
    [
      "totalPayments",
      "totalEth",
      "latestPayment",
      "agreementIdDisplay",
    ].forEach((id) => {
      const el = document.getElementById(id);

      if (el) {
        el.textContent = "—";
      }
    });
  }

  // ============================================================
  // INITIALIZE
  // ============================================================

  async function initHistory() {
    const sel = document.getElementById("agreementSelect");

    if (!sel) {
      console.log("⏭️ Not on history page – skipping init.");

      return;
    }

    console.log("🚀 initHistory() called");

    // --------------------------------------------------------
    // Web3 connection
    // --------------------------------------------------------

    if (!window.contract) {
      try {
        if (typeof window.connectWallet === "function") {
          await window.connectWallet();
        }
      } catch (e) {
        console.warn("Auto-connect failed:", e);
      }
    }

    if (!window.userWalletAddress) {
      const stored = window.Auth?.getWallet
        ? window.Auth.getWallet()
        : localStorage.getItem("traxenWallet");

      if (stored) {
        window.userWalletAddress = stored;
      }
    }

    // --------------------------------------------------------
    // Toggle listener
    // --------------------------------------------------------

    const toggle = document.getElementById("showAllToggle");

    if (toggle) {
      toggle.removeEventListener("change", loadHistory);

      toggle.addEventListener("change", loadHistory);
    }

    // --------------------------------------------------------
    // Agreement selector listener
    // --------------------------------------------------------

    if (sel) {
      sel.removeEventListener("change", onAgreementSelect);

      sel.addEventListener("change", onAgreementSelect);
    }

    await loadAgreements();
  }

  function onAgreementSelect() {
    const toggle = document.getElementById("showAllToggle");

    if (toggle && toggle.checked) {
      toggle.checked = false;
    }

    loadHistory();
  }

  // ============================================================
  // WALLET EVENT
  // ============================================================

  window.addEventListener("walletConnected", async function () {
    if (document.getElementById("agreementSelect")) {
      await initHistory();
    }
  });

  // ============================================================
  // EXPORT
  // ============================================================

  window.loadHistory = loadHistory;

  window.loadAgreements = loadAgreements;

  window.initHistory = initHistory;

  window.debugInit = initHistory;
})();
