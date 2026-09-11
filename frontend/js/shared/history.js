// ─── Transaction History (verified on-chain, invalid rows removed) ──
console.log("🚀 history.js loaded");

(function () {
  let allPayments = [];

  // ─── In-memory verification cache (per tx hash) ──────────
  const VERIFICATION_TTL = 5 * 60 * 1000;
  const _verifyCache = new Map();

  // ─── Expected chain ──────────────────────────────────────
  const EXPECTED_CHAIN_ID = 11155111; // Sepolia
  const EXPECTED_CHAIN_NAME = "Sepolia";

  // ─── Cache helpers ───────────────────────────────────────
  function cacheKey(wallet, role) {
    return `history_${wallet.toLowerCase()}_${role.toLowerCase()}`;
  }

  function getCachedHistory(wallet, role) {
    try {
      const raw = localStorage.getItem(cacheKey(wallet, role));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.payments)) return null;
      return parsed.payments;
    } catch (e) {
      return null;
    }
  }

  function setCachedHistory(wallet, role, payments) {
    try {
      localStorage.setItem(
        cacheKey(wallet, role),
        JSON.stringify({ payments, cachedAt: Date.now() })
      );
    } catch (e) {}
  }

  function invalidateHistoryCache(wallet, role) {
    try {
      if (wallet && role) {
        localStorage.removeItem(cacheKey(wallet, role));
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
        setTimeout(() => rej(new Error("RPC timeout")), ms)
      ),
    ]);
  }

  // ─── Network check (cached per page load) ────────────────
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

  // Verify a tx exists on the CURRENT contract
  async function verifyTxOnChain(txHash) {
    if (!txHash || txHash === "—") {
      return { ok: false, reason: "no hash", transient: true };
    }

    const cached = _verifyCache.get(txHash);
    if (cached && Date.now() - cached.time < VERIFICATION_TTL) {
      return cached;
    }

    const provider = getReadProvider();
    if (!provider) {
      return { ok: false, reason: "no provider", transient: true };
    }

    // Network guard — never verify on wrong chain
    const netCheck = await checkNetwork(provider);
    if (!netCheck.ok) {
      return { ok: false, reason: netCheck.reason, transient: true };
    }

    const expectedContract = getContractAddress();
    if (!expectedContract) {
      return { ok: false, reason: "no contract address", transient: true };
    }

    try {
      const tx = await withTimeout(provider.getTransaction(txHash), 4000);
      if (!tx) {
        // Not found → could be wrong hash or fresh tx. Treat as permanent
        // because we reached the RPC successfully.
        const result = {
          ok: false,
          reason: "tx not found",
          time: Date.now(),
          transient: false,
        };
        _verifyCache.set(txHash, result);
        return result;
      }

      if (tx.to?.toLowerCase() !== expectedContract.toLowerCase()) {
        const result = {
          ok: false,
          reason: "wrong contract",
          time: Date.now(),
          transient: false,
        };
        _verifyCache.set(txHash, result);
        return result;
      }

      const receipt = await withTimeout(
        provider.getTransactionReceipt(txHash),
        4000
      );
      if (!receipt) {
        // Pending tx — don't hide the row, retry later
        const result = {
          ok: false,
          reason: "pending",
          time: Date.now(),
          transient: true,
        };
        _verifyCache.set(txHash, result);
        return result;
      }

      if (receipt.status !== 1) {
        const result = {
          ok: false,
          reason: "tx reverted",
          time: Date.now(),
          transient: false,
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
        transient: isTimeout,
      };
      _verifyCache.set(txHash, result);
      return result;
    }
  }

  // Concurrency pool (3 RPC calls at a time)
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

  // Update a row's badge in the DOM
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

  // Remove a row after permanent verification failure
  function removeRow(txHash, reason) {
    const row = document.querySelector(`[data-verify-row="${txHash}"]`);
    if (!row) return;
    row.style.transition = "opacity 0.25s";
    row.style.opacity = "0";
    setTimeout(() => row.remove(), 250);
    console.log(`🗑️ Row removed (${reason}): ${txHash.slice(0, 10)}…`);
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
    notice.textContent = `ℹ️ ${hiddenCount} transaction(s) hidden — not found on the current ${EXPECTED_CHAIN_NAME} contract.`;
  }

  // Big banner when every row is invalid
  function showAllInvalidBanner(hiddenCount) {
    const container = document.getElementById("historyContent");
    if (!container) return;
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-faint);">
        <div style="font-size:36px;margin-bottom:12px;">📭</div>
        <div style="font-size:15px;margin-bottom:6px;color:var(--text);">
          No transactions on the current contract
        </div>
        <div style="font-size:12px;">
          ${hiddenCount} row(s) belong to a previous contract deployment.
        </div>
        <div style="font-size:12px;margin-top:8px;">
          Contract: <span class="mono">${(getContractAddress() || "").slice(0, 10)}…</span>
        </div>
      </div>
    `;
  }

  // Verify all rows in background; remove only permanent failures
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
        setRowBadge(p.txHash, result);
        console.log(
          `⚠️ Transient verify failure for ${p.txHash.slice(0, 10)}… — keeping row`
        );
        return;
      }

      // Permanent failure → remove
      setRowBadge(p.txHash, result);
      setTimeout(() => removeRow(p.txHash, result.reason), 400);
      hiddenCount++;
    });

    const valid = payments.filter((p) => {
      const v = _verifyCache.get(p.txHash);
      return v?.ok === true;
    });

    if (valid.length === 0 && hiddenCount > 0) {
      showAllInvalidBanner(hiddenCount);
      updateStats([]);
      return;
    }

    updateStats(valid);
    showHiddenNotice();
    console.log(
      `✅ Verification complete — ${valid.length} valid, ${hiddenCount} hidden`
    );
  }

  // ═══════════════════════════════════════════════════════════
  // FETCH
  // ═══════════════════════════════════════════════════════════
  async function fetchHistoryFromNetwork(wallet, role) {
    const roleParam = role ? `?role=${role.toLowerCase()}` : "";
    const headers =
      typeof window.getAuthHeaders === "function"
        ? window.getAuthHeaders()
        : {
            "Content-Type": "application/json",
            "x-wallet-address": wallet,
          };

    let res = await fetch(`/api/history${roleParam}`, { headers });

    if (res.status === 401) {
      console.warn("⚠️ 401 on history fetch — retrying after 400ms");
      await new Promise((r) => setTimeout(r, 400));
      const retryHeaders =
        typeof window.getAuthHeaders === "function"
          ? window.getAuthHeaders()
          : headers;
      res = await fetch(`/api/history${roleParam}`, { headers: retryHeaders });
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.payments || [];
  }

  // ═══════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════
  async function loadHistory() {
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
      return;
    }

    _networkCheckResult = null;
    _verifyCache.clear();

    const oldNotice = document.getElementById("history-hidden-notice");
    if (oldNotice) oldNotice.remove();

    const cached = getCachedHistory(wallet, role);
    if (cached) {
      console.log(`⚡ History: cache hit (${cached.length} rows)`);
      allPayments = cached;
      renderHistory(cached);
      updateStats(cached);
      verifyAndFilterRows(cached);

      fetchHistoryFromNetwork(wallet, role)
        .then((fresh) => {
          setCachedHistory(wallet, role, fresh);
          if (fresh.length !== cached.length) {
            console.log("🔄 History: data changed, re-rendering");
            allPayments = fresh;
            renderHistory(fresh);
            updateStats(fresh);
            verifyAndFilterRows(fresh);
          }
        })
        .catch((err) =>
          console.warn("Background history refresh failed:", err.message)
        );

      return;
    }

    try {
      const payments = await fetchHistoryFromNetwork(wallet, role);
      allPayments = payments;
      setCachedHistory(wallet, role, payments);
      renderHistory(payments);
      updateStats(payments);
      log(`✅ Loaded ${payments.length} payment(s) for ${role}`);

      verifyAndFilterRows(payments);
    } catch (e) {
      console.error("Load history error:", e);
      if (container) {
        container.innerHTML = `<div style="color:var(--text-faint);padding:12px 0;">❌ ${e.message}</div>`;
      }
      clearStats();
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
  // INIT — with wait-for-ready retry
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
      return;
    }

    await loadHistory();
  }

  // ─── Listeners ──────────────────────────────────────────
  window.addEventListener("walletConnected", async function () {
    if (document.getElementById("historyContent")) await initHistory();
  });

  window.addEventListener("walletDisconnected", function () {
    invalidateHistoryCache();
  });

  // Re-verify on chain change
  if (window.ethereum?.on) {
    window.ethereum.on("chainChanged", function () {
      console.log("⛓️ Chain changed — re-verifying history");
      _networkCheckResult = null;
      _verifyCache.clear();
      if (document.getElementById("historyContent")) {
        loadHistory();
      }
    });
  }

  // ─── Expose ─────────────────────────────────────────────
  window.loadHistory = loadHistory;
  window.initHistory = initHistory;
  window.debugInit = initHistory;
  window.invalidateHistoryCache = invalidateHistoryCache;
  window.verifyTxOnChain = verifyTxOnChain;

  // ─── Auto-init ──────────────────────────────────────────
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    if (document.getElementById("historyContent")) {
      initHistory();
    }
  }
})();