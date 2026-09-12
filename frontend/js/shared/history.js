// ─── Transaction History (verify + remove non-network rows) ──
console.log("🚀 history.js loaded");

(function () {
  let allPayments = [];

  // ─── Pagination state ────────────────────────────────────
  const PAGE_SIZE = 10;
  let currentPage = 1;
  let totalPages = 1;
  let totalCount = 0;

  // ─── In-memory verification cache ────────────────────────
  const VERIFICATION_TTL = 5 * 60 * 1000;
  const _verifyCache = new Map();

  // ─── Expected chain ──────────────────────────────────────
  const EXPECTED_CHAIN_ID = 11155111; // Sepolia
  const EXPECTED_CHAIN_NAME = "Sepolia";

  // ─── Cache helpers ───────────────────────────────────────
  function cacheKey(wallet, role, page = 1) {
    return `history_${wallet.toLowerCase()}_${role.toLowerCase()}_p${page}`;
  }

  function getCachedHistory(wallet, role, page = 1) {
    try {
      const raw = localStorage.getItem(cacheKey(wallet, role, page));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.payments)) return null;
      return parsed.payments;
    } catch (e) {
      return null;
    }
  }

  function setCachedHistory(wallet, role, payments, page = 1) {
    try {
      localStorage.setItem(
        cacheKey(wallet, role, page),
        JSON.stringify({ payments, cachedAt: Date.now() }),
      );
    } catch (e) {}
  }

  function invalidateHistoryCache(wallet, role) {
    try {
      if (wallet && role) {
        Object.keys(localStorage)
          .filter((k) =>
            k.startsWith(
              `history_${wallet.toLowerCase()}_${role.toLowerCase()}_`,
            ),
          )
          .forEach((k) => localStorage.removeItem(k));
      } else {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("history_"))
          .forEach((k) => localStorage.removeItem(k));
      }
      _verifyCache.clear();
      console.log("🗑️ History cache invalidated");
    } catch (e) {}
  }

  // ─── Helpers ─────────────────────────────────────────────
  function log(msg) {
    const el = document.getElementById("output");
    if (el) el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
  }

  function getWalletAddress() {
    if (window.API?.getWallet) return window.API.getWallet();
    if (window.userWalletAddress) return window.userWalletAddress.toLowerCase();
    if (typeof window.Auth?.getWallet === "function") {
      const w = window.Auth.getWallet();
      if (w) return w.toLowerCase();
    }
    const stored = localStorage.getItem("traxenWallet");
    return stored ? stored.toLowerCase() : null;
  }

  function getCurrentRole() {
    if (typeof window.Auth?.getCurrentRole === "function") {
      return window.Auth.getCurrentRole();
    }
    return (
      localStorage.getItem("traxenUserRole") ||
      localStorage.getItem("traxenRole") ||
      "Shipper"
    );
  }

  // ═══════════════════════════════════════════════════════════
  // DEFENSIVE FILTER — only money events
  // ═══════════════════════════════════════════════════════════
  const ALLOWED_TYPES = ["deposit", "release", "payment", "refund"];

  function isMoneyEvent(p) {
    if (!p) return false;
    const t = (p.type || "").toLowerCase();
    const allowed = ALLOWED_TYPES.some((k) => t.includes(k));
    if (!allowed) return false;
    if (t.includes("milestone") && !t.includes("release")) return false;
    return true;
  }

  function sanitizePayments(payments) {
    if (!Array.isArray(payments)) return [];
    const filtered = payments.filter(isMoneyEvent);
    if (filtered.length !== payments.length) {
      console.log(
        `🧹 Filtered out ${payments.length - filtered.length} non-money row(s)`,
      );
    }
    return filtered;
  }

  // ═══════════════════════════════════════════════════════════
  // ON-CHAIN VERIFICATION
  // ═══════════════════════════════════════════════════════════
  function getContractAddress() {
    return window.__CONFIG?.contractAddress || window.contract?.target || null;
  }

  function getReadProvider() {
    if (!window.ethereum) return null;
    try {
      return new ethers.BrowserProvider(window.ethereum);
    } catch (e) {
      return null;
    }
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("RPC timeout")), ms),
      ),
    ]);
  }

  let _networkCheckResult = null;
  async function checkNetwork(provider) {
    if (_networkCheckResult) return _networkCheckResult;
    try {
      const net = await withTimeout(provider.getNetwork(), 3000);
      const chainId = Number(net.chainId);
      if (chainId !== EXPECTED_CHAIN_ID) {
        _networkCheckResult = {
          ok: false,
          chainId,
          reason: `Wrong network — expected ${EXPECTED_CHAIN_NAME} (${EXPECTED_CHAIN_ID}), got chain ${chainId}`,
        };
      } else {
        _networkCheckResult = { ok: true, chainId };
      }
      return _networkCheckResult;
    } catch (e) {
      _networkCheckResult = {
        ok: false,
        reason: "Network check failed: " + e.message,
      };
      return _networkCheckResult;
    }
  }

  async function verifyTxOnChain(txHash) {
    if (!txHash || txHash === "—") {
      return { ok: false, reason: "no hash", transient: true };
    }

    const cached = _verifyCache.get(txHash);
    if (cached && Date.now() - cached.time < VERIFICATION_TTL) {
      return cached;
    }

    const provider = getReadProvider();
    if (!provider) return { ok: false, reason: "no provider", transient: true };

    const netCheck = await checkNetwork(provider);
    if (!netCheck.ok)
      return { ok: false, reason: netCheck.reason, transient: true };

    const expectedContract = getContractAddress();
    if (!expectedContract)
      return { ok: false, reason: "no contract address", transient: true };

    try {
      const tx = await withTimeout(provider.getTransaction(txHash), 4000);
      if (!tx) {
        // Tx doesn't exist on the chain → NOT this network
        const result = {
          ok: false,
          reason: "tx not found",
          time: Date.now(),
          transient: false, // ← permanent → remove
        };
        _verifyCache.set(txHash, result);
        return result;
      }

      if (tx.to?.toLowerCase() !== expectedContract.toLowerCase()) {
        // Tx went to a different contract → NOT this contract
        const result = {
          ok: false,
          reason: "wrong contract",
          time: Date.now(),
          transient: false, // ← permanent → remove
        };
        _verifyCache.set(txHash, result);
        return result;
      }

      const receipt = await withTimeout(
        provider.getTransactionReceipt(txHash),
        4000,
      );
      if (!receipt) {
        // Pending — keep, retry later
        const result = {
          ok: false,
          reason: "pending",
          time: Date.now(),
          transient: true, // ← transient → keep
        };
        _verifyCache.set(txHash, result);
        return result;
      }

      if (receipt.status !== 1) {
        // Tx reverted → failed on chain → remove
        const result = {
          ok: false,
          reason: "tx reverted",
          time: Date.now(),
          transient: false, // ← permanent → remove
        };
        _verifyCache.set(txHash, result);
        return result;
      }

      const result = {
        ok: true,
        block: receipt.blockNumber,
        time: Date.now(),
        transient: false,
      };
      _verifyCache.set(txHash, result);
      return result;
    } catch (e) {
      const isTimeout = /timeout|network|fetch/i.test(e.message);
      const result = {
        ok: false,
        reason: e.message,
        time: Date.now(),
        transient: isTimeout, // ← timeout → keep, other → remove
      };
      _verifyCache.set(txHash, result);
      return result;
    }
  }

  async function withConcurrency(items, limit, worker) {
    const queue = [...items];
    const workers = Array.from({ length: limit }, async () => {
      while (queue.length) {
        const item = queue.shift();
        try {
          await worker(item);
        } catch (e) {}
      }
    });
    await Promise.all(workers);
  }

  function setRowBadge(txHash, state) {
    const badge = document.querySelector(`[data-verify-tx="${txHash}"]`);
    if (!badge) return;

    if (state === "loading") {
      badge.textContent = "⏳";
      badge.style.color = "var(--text-faint)";
      badge.title = "Verifying on Sepolia…";
      return;
    }

    if (state.ok) {
      badge.textContent = "✅";
      badge.style.color = "var(--lime)";
      badge.title = `Verified at block ${state.block}`;
    } else if (state.transient) {
      badge.textContent = "⚠️";
      badge.style.color = "var(--amber)";
      badge.title = state.reason || "Verification pending (retry later)";
    } else {
      badge.textContent = "❌";
      badge.style.color = "var(--red)";
      badge.title = state.reason || "Verification failed";
    }
  }

  // ─── Remove a row after a permanent verification failure ─
  function removeRow(txHash, reason) {
    const row = document.querySelector(`[data-verify-row="${txHash}"]`);
    if (!row) return;
    row.style.transition = "opacity 0.3s, transform 0.3s";
    row.style.opacity = "0";
    row.style.transform = "translateX(-8px)";
    setTimeout(() => row.remove(), 300);
    console.log(`🗑️ Removed (${reason}): ${txHash.slice(0, 10)}…`);
  }

  // Notice for hidden rows
  let hiddenCount = 0;
  function showHiddenNotice() {
    if (hiddenCount === 0) return;
    let notice = document.getElementById("history-hidden-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "history-hidden-notice";
      notice.style.cssText =
        "color:var(--text-faint);font-size:12px;padding:8px 0;font-style:italic;";
      const container = document.getElementById("historyContent");
      if (container) container.parentNode.appendChild(notice);
    }
    notice.textContent = `ℹ️ ${hiddenCount} transaction(s) removed — not part of the current ${EXPECTED_CHAIN_NAME} contract.`;
  }

  function clearHiddenNotice() {
    const n = document.getElementById("history-hidden-notice");
    if (n) n.remove();
  }

  // Verify + remove rows that don't belong to this network
  async function verifyAndFilterRows(payments) {
    if (!window.ethereum) {
      console.log("ℹ️ No wallet — skipping verification");
      return;
    }

    const toVerify = payments.filter((p) => p.txHash && p.txHash !== "—");
    if (toVerify.length === 0) return;

    console.log(`🔍 Verifying ${toVerify.length} tx(s) on Sepolia…`);
    hiddenCount = 0;

    toVerify.forEach((p) => setRowBadge(p.txHash, "loading"));

    await withConcurrency(toVerify, 3, async (p) => {
      const result = await verifyTxOnChain(p.txHash);

      if (result.ok) {
        setRowBadge(p.txHash, result);
        return;
      }

      if (result.transient) {
        // RPC slow, pending, wrong network in MetaMask → keep the row
        setRowBadge(p.txHash, result);
        console.log(`⚠️ Transient: ${p.txHash.slice(0, 10)}… — keeping row`);
        return;
      }

      // Permanent failure → remove the row
      setRowBadge(p.txHash, result);
      setTimeout(() => removeRow(p.txHash, result.reason), 500);
      hiddenCount++;
    });

    // Recompute stats with only valid rows
    const valid = payments.filter((p) => {
      if (p.txHash === "—") return true; // no hash → still valid (shouldn't happen with our filters)
      const v = _verifyCache.get(p.txHash);
      return v?.ok === true;
    });

    updateStats(valid);
    showHiddenNotice();
    console.log(
      `✅ Verification complete — ${valid.length} valid, ${hiddenCount} removed`,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // FETCH
  // ═══════════════════════════════════════════════════════════
  async function fetchHistoryFromNetwork(wallet, role, page = 1) {
    const params = new URLSearchParams();
    if (role) params.set("role", role.toLowerCase());
    params.set("page", page);
    params.set("limit", PAGE_SIZE);

    const url = `/api/history?${params.toString()}`;

    if (typeof window.getAuthHeaders !== "function") {
      throw new Error("Auth not initialised — cannot fetch history.");
    }

    // First attempt with Bearer token
    let res = await fetch(url, { headers: window.getAuthHeaders() });

    // On 401, refresh session once, then retry with a fresh token
    if (res.status === 401) {
      console.warn("⚠️ 401 on history fetch — refreshing session");

      if (typeof window.Auth?.ensureFullSession === "function") {
        const ok = await window.Auth.ensureFullSession();
        if (ok) {
          res = await fetch(url, { headers: window.getAuthHeaders() });
        }
      } else if (typeof window.Auth?.clearSession === "function") {
        window.Auth.clearSession();
      }
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const cleaned = sanitizePayments(data.payments || []);

    return {
      payments: cleaned,
      pagination: data.pagination || {
        page: 1,
        limit: PAGE_SIZE,
        total: cleaned.length,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════
  async function loadHistory(page = currentPage) {
    const container = document.getElementById("historyContent");
    const desc = document.getElementById("historyDesc");

    const role = getCurrentRole();
    const wallet = getWalletAddress();

    if (desc) {
      desc.textContent =
        role.toLowerCase() === "carrier"
          ? "All payment releases you have received"
          : "All transactions across your agreements";
    }

    if (!wallet) {
      if (container) {
        container.innerHTML =
          '<div style="color:var(--text-faint);padding:12px 0;">Please connect your wallet.</div>';
      }
      clearStats();
      clearPagination();
      clearHiddenNotice();
      return;
    }

    currentPage = page;
    _networkCheckResult = null;
    _verifyCache.clear();
    clearHiddenNotice();

    const cached = getCachedHistory(wallet, role, currentPage);
    if (cached) {
      const sanitized = sanitizePayments(cached);
      if (sanitized.length !== cached.length) {
        console.log("🧹 Stale cache detected — refetching from network");
        localStorage.removeItem(cacheKey(wallet, role, currentPage));
      } else {
        console.log(
          `⚡ History: cache hit (page ${currentPage}, ${sanitized.length} rows)`,
        );
        allPayments = sanitized;
        renderHistory(sanitized);
        renderPagination();
        updateStats(sanitized);
        verifyAndFilterRows(sanitized);
        return;
      }
    }

    try {
      const { payments, pagination } = await fetchHistoryFromNetwork(
        wallet,
        role,
        currentPage,
      );

      allPayments = payments;
      totalPages = pagination.totalPages || 1;
      totalCount = pagination.total || payments.length;
      currentPage = pagination.page || 1;

      setCachedHistory(wallet, role, payments, currentPage);
      renderHistory(payments);
      renderPagination();
      updateStats(payments);
      log(
        `✅ Loaded page ${currentPage}/${totalPages} (${payments.length} rows)`,
      );

      verifyAndFilterRows(payments);
    } catch (e) {
      console.error("Load history error:", e);
      if (container) {
        container.innerHTML = `<div style="color:var(--text-faint);padding:12px 0;">❌ ${e.message}</div>`;
      }
      clearStats();
      clearPagination();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  function renderHistory(payments) {
    const container = document.getElementById("historyContent");
    if (!container) return;

    if (!payments || payments.length === 0) {
      container.innerHTML =
        '<div style="color:var(--text-faint);padding:12px 0;">📭 No transactions found.</div>';
      return;
    }

    const isCarrier = getCurrentRole().toLowerCase() === "carrier";

    const rows = payments
      .map((p) => {
        const amount =
          p.amountEth ||
          (p.amount != null ? ethers.formatEther(String(p.amount)) : "—");

        const rawType = p.type || "Event";
        let label = rawType;
        if (rawType.toLowerCase().includes("deposit")) {
          label = isCarrier
            ? "💰 Escrow Funded (by shipper)"
            : "💸 You Funded Escrow";
        } else if (
          rawType.toLowerCase().includes("release") ||
          rawType.toLowerCase().includes("payment")
        ) {
          label = isCarrier
            ? "✅ You Received Payment"
            : "📤 You Released Payment";
        } else if (rawType.toLowerCase().includes("refund")) {
          label = isCarrier ? "↩️ Refund to Shipper" : "↩️ You Were Refunded";
        }

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

        const verifyBadge =
          txHash !== "—"
            ? `<span data-verify-tx="${txHash}" style="color:var(--text-faint);" title="Verifying on Sepolia...">⏳</span>`
            : `<span style="color:var(--text-faint);">—</span>`;

        return `
        <tr data-verify-row="${txHash}">
          <td>${label}${agreementLabel ? " · " + agreementLabel : ""}</td>
          <td>${amount} ETH</td>
          <td class="mono">${shortHash}</td>
          <td>${time ? new Date(time).toLocaleString() : "—"}</td>
          <td><span class="pill ${statusClass}"><span class="dot"></span>${status}</span></td>
          <td style="text-align:center;font-size:16px;">${verifyBadge}</td>
        </tr>
      `;
      })
      .join("");

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Amount</th>
            <th>Tx Hash</th>
            <th>Timestamp</th>
            <th>Status</th>
            <th title="Verified on the current Sepolia contract">On-Chain</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════════
  function renderPagination() {
    let container = document.getElementById("historyPagination");
    if (!container) {
      const table = document.getElementById("historyContent");
      if (!table) return;
      container = document.createElement("div");
      container.id = "historyPagination";
      container.style.cssText =
        "display:flex;align-items:center;justify-content:center;gap:6px;" +
        "padding:14px 0;color:var(--text-faint);font-size:13px;flex-wrap:wrap;";
      table.parentNode.appendChild(container);
    }

    if (totalPages <= 1) {
      container.innerHTML =
        totalCount > 0
          ? `<span style="font-size:12px;">${totalCount} transaction(s)</span>`
          : "";
      return;
    }

    const btnStyle =
      "background:var(--panel-2,#1e1e2a);border:1px solid var(--border-soft,#333);" +
      "color:var(--text,#fff);padding:6px 12px;border-radius:6px;cursor:pointer;" +
      "font-size:13px;";
    const disabledStyle = btnStyle + "opacity:0.4;cursor:not-allowed;";
    const activeStyle =
      btnStyle + "background:var(--lime,#22c55e);color:#000;font-weight:600;";

    const pageNumbers = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pageNumbers.push(i);

    let html = "";

    html += `<button onclick="window.goToHistoryPage(${currentPage - 1})"
      ${currentPage <= 1 ? "disabled" : ""}
      style="${currentPage > 1 ? btnStyle : disabledStyle}">← Prev</button>`;

    if (start > 1) {
      html += `<button onclick="window.goToHistoryPage(1)" style="${btnStyle}">1</button>`;
      if (start > 2) html += `<span style="padding:0 4px;">…</span>`;
    }

    pageNumbers.forEach((p) => {
      html += `<button onclick="window.goToHistoryPage(${p})"
        style="${p === currentPage ? activeStyle : btnStyle}">${p}</button>`;
    });

    if (end < totalPages) {
      if (end < totalPages - 1) html += `<span style="padding:0 4px;">…</span>`;
      html += `<button onclick="window.goToHistoryPage(${totalPages})" style="${btnStyle}">${totalPages}</button>`;
    }

    html += `<button onclick="window.goToHistoryPage(${currentPage + 1})"
      ${currentPage >= totalPages ? "disabled" : ""}
      style="${currentPage < totalPages ? btnStyle : disabledStyle}">Next →</button>`;

    html += `<span style="margin-left:12px;font-size:12px;">Page ${currentPage} of ${totalPages} · ${totalCount} total</span>`;

    container.innerHTML = html;
  }

  function clearPagination() {
    const el = document.getElementById("historyPagination");
    if (el) el.innerHTML = "";
  }

  window.goToHistoryPage = function (page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    currentPage = page;
    const table = document.getElementById("historyContent");
    if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
    loadHistory(page);
  };

  // ═══════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════
  function updateStats(payments) {
    const totalPaymentsEl = document.getElementById("totalPayments");
    const totalEthEl = document.getElementById("totalEth");
    const latestPaymentEl = document.getElementById("latestPayment");
    const agreementIdDisplayEl = document.getElementById("agreementIdDisplay");

    if (!totalPaymentsEl || !totalEthEl || !latestPaymentEl) return;

    const total = payments.length;
    const totalEth = payments.reduce((sum, p) => {
      const amt =
        p.amountEth ||
        (p.amount != null ? ethers.formatEther(String(p.amount)) : "0");
      const num = parseFloat(amt);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
    const latest = payments.length > 0 ? payments[0] : null;

    totalPaymentsEl.textContent = total;
    totalEthEl.textContent = totalEth.toFixed(4) + " ETH";
    latestPaymentEl.textContent = latest
      ? latest.timestamp
        ? new Date(latest.timestamp).toLocaleString()
        : "—"
      : "—";

    if (agreementIdDisplayEl) agreementIdDisplayEl.textContent = "All";
  }

  function clearStats() {
    ["totalPayments", "totalEth", "latestPayment"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    });
    const agEl = document.getElementById("agreementIdDisplay");
    if (agEl) agEl.textContent = "All";
  }

  // ═══════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════
  async function initHistory(attempt = 1) {
    if (!document.getElementById("historyContent")) return;
    console.log(`🚀 initHistory() called (attempt ${attempt})`);

    if (!window.userWalletAddress) {
      const stored = window.Auth?.getWallet
        ? window.Auth.getWallet()
        : localStorage.getItem("traxenWallet");
      if (stored) window.userWalletAddress = stored;
    }

    if (!window.userWalletAddress) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 500));
        return initHistory(attempt + 1);
      }
      const container = document.getElementById("historyContent");
      if (container) {
        container.innerHTML =
          '<div style="color:var(--text-faint);padding:12px 0;">Please connect your wallet to view history.</div>';
      }
      clearStats();
      clearPagination();
      return;
    }

    currentPage = 1;
    await loadHistory(1);
  }

  // ─── Listeners ──────────────────────────────────────────
  window.addEventListener("walletConnected", async function () {
    if (document.getElementById("historyContent")) await initHistory();
  });

  window.addEventListener("walletDisconnected", function () {
    invalidateHistoryCache();
  });

  if (window.ethereum?.on) {
    window.ethereum.on("chainChanged", function () {
      console.log("⛓️ Chain changed — re-verifying history");
      _networkCheckResult = null;
      _verifyCache.clear();
      if (document.getElementById("historyContent")) {
        loadHistory(currentPage);
      }
    });
  }

  // ─── Expose ─────────────────────────────────────────────
  window.loadHistory = loadHistory;
  window.initHistory = initHistory;
  window.debugInit = initHistory;
  window.invalidateHistoryCache = invalidateHistoryCache;
  window.verifyTxOnChain = verifyTxOnChain;

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    if (document.getElementById("historyContent")) {
      initHistory();
    }
  }
})();
