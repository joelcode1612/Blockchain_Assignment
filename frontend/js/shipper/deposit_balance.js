// ─── Deposit & Balance – SPA‑ready (IIFE) ────────────────
console.log("🚀 deposit_balance.js loaded");

(function () {
  let currentAgreementId = null;
  let allAgreements = [];
  let agreementData = {};
  let isProcessing = false;

  // ─── Toast helper ──────────────────────────────────────────
  function showToast(message, type = "info", duration = 4000) {
    const container = document.getElementById("toast-container");
    if (!container) {
      console.warn("Toast container not found.");
      return;
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("toast-hidden");
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, duration);
  }

  function log(msg) {
    const el = document.getElementById("output");
    if (el) el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
  }

  function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function getWalletAddress() {
    if (window.userWalletAddress) return window.userWalletAddress.toLowerCase();
    if (typeof window.Auth?.getWallet === "function") {
      const wallet = window.Auth.getWallet();
      if (wallet) return wallet.toLowerCase();
    }
    const stored = localStorage.getItem("traxenWallet");
    if (stored) return stored.toLowerCase();
    return null;
  }

  // ─── Ensure contract exists (no auto‑connect) ──────────
  function ensureContract() {
    if (window.contract) return true;
    console.warn(
      "⚠️ window.contract is not available. Please connect your wallet.",
    );
    showToast("Please connect your wallet manually.", "error");
    return false;
  }

  // ─── Load Agreements ──────────────────────────────────────
  async function loadAgreements() {
    console.log("🔍 loadAgreements() called");
    const address = getWalletAddress();
    if (!address) {
      console.warn("⚠️ No wallet address – connect first.");
      return [];
    }
    console.log("📌 Using address:", address);

    try {
      const res = await fetch("/api/agreements", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      allAgreements = await res.json();
      console.log("✅ Agreements loaded:", allAgreements);

      const sel = document.getElementById("agreementSelect");
      if (!sel) {
        console.warn("⚠️ #agreementSelect missing");
        return;
      }
      sel.innerHTML = '<option value="">— Select —</option>';
      allAgreements.forEach((ag) => {
        const opt = document.createElement("option");
        opt.value = ag.onchain_id;
        const status = ag.status || "Pending";
        opt.textContent = `AGR-${String(ag.onchain_id).padStart(4, "0")} (${status})`;
        sel.appendChild(opt);
      });

      const requestedId = getUrlParam("id") || getUrlParam("agreementId");
      let selectedId = null;
      if (requestedId) {
        const numericId = parseInt(requestedId);
        if (
          !isNaN(numericId) &&
          allAgreements.some((a) => a.onchain_id === numericId)
        ) {
          selectedId = numericId;
          console.log(
            `📌 Found requested agreement ID ${selectedId} in the list.`,
          );
        }
      }
      if (selectedId !== null) sel.value = selectedId;
      else if (allAgreements.length > 0)
        sel.value = allAgreements[0].onchain_id;

      if (allAgreements.length > 0) {
        await loadAgreementData();
      } else {
        const table = document.getElementById("allAgreementsTable");
        if (table)
          table.innerHTML =
            '<div style="color:var(--text-faint);padding:12px 0;">No agreements found.</div>';
        clearUI();
      }
      await refreshAllAgreements();
    } catch (e) {
      console.error("❌ loadAgreements error:", e);
      const table = document.getElementById("allAgreementsTable");
      if (table) table.innerHTML = `❌ ${e.message}`;
    }
  }

  // ─── Refresh All Agreements Table ──────────────────────────
  async function refreshAllAgreements() {
    const container = document.getElementById("allAgreementsTable");
    if (!container) return;
    if (!allAgreements || allAgreements.length === 0) {
      container.innerHTML =
        '<div style="color:var(--text-faint);padding:12px 0;">No agreements found.</div>';
      return;
    }
    let rows = [];
    for (const ag of allAgreements) {
      const totalEth = ag.total_amount_eth || "0";
      const status = ag.status || "Pending";
      let statusClass = "gray";
      if (status === "Active" || status === "Funded") statusClass = "lime";
      else if (status === "Completed") statusClass = "lime";
      else if (status === "Refunded") statusClass = "red";
      else if (status === "Pending" || status === "PendingAcceptance")
        statusClass = "amber";

      let balanceEth = "—";
      let depositedEth = "—";
      if (window.contract) {
        try {
          const balWei = await window.contract.getEscrowBalance(ag.onchain_id);
          balanceEth = ethers.formatEther(balWei);
          const total = parseFloat(totalEth);
          const bal = parseFloat(balanceEth);
          depositedEth = (total - bal).toFixed(4);
        } catch (e) {
          console.warn(
            `Could not fetch on‑chain balance for AGR-${ag.onchain_id}:`,
            e.message,
          );
        }
      }
      rows.push(`
        <tr>
          <td>AGR-${String(ag.onchain_id).padStart(4, "0")}</td>
          <td>${totalEth} ETH</td>
          <td>${depositedEth} ETH</td>
          <td>${balanceEth} ETH</td>
          <td><span class="pill ${statusClass}"><span class="dot"></span>${status.toUpperCase()}</span></td>
        </tr>
      `);
    }
    container.innerHTML = `
      <table>
        <thead><tr><th>Agreement</th><th>Required</th><th>Deposited</th><th>Remaining</th><th>Status</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    `;
  }

  // ─── Load Selected Agreement Data ──────────────────────────
  async function loadAgreementData() {
    console.log("🔍 loadAgreementData called");
    const sel = document.getElementById("agreementSelect");
    if (!sel) return;
    const id = parseInt(sel.value);
    currentAgreementId = isNaN(id) ? null : id;
    if (currentAgreementId === null) {
      clearUI();
      return;
    }
    const agreement = allAgreements.find(
      (a) => a.onchain_id === currentAgreementId,
    );
    if (!agreement) {
      log(`❌ Agreement ${currentAgreementId} not found`);
      clearUI();
      return;
    }

    const status = agreement.status || "Pending";
    const funded =
      status === "Active" || status === "Funded" || status === "Completed";
    const completed = status === "Completed";
    const pendingAcceptance = status === "PendingAcceptance";
    const awaitingFunding = status === "AwaitingFunding";

    let totalEth = "0";
    let balanceEth = "0";
    let remainingEth = "0";

    // Ensure contract is ready
    if (window.contract) {
      try {
        const contractData =
          await window.contract.getAgreement(currentAgreementId);
        // ✅ Read total from contract
        const totalWei = contractData[3];
        totalEth = ethers.formatEther(totalWei);

        const contractStatusNum = Number(contractData[6]);
        const statusNames = [
          "PendingAcceptance",
          "AwaitingFunding",
          "Active",
          "Completed",
          "Rejected",
          "Cancelled",
          "Refunded",
          "Expired",
        ];
        const contractStatus = statusNames[contractStatusNum] || "Unknown";
        const contractFunded =
          contractStatus === "Active" || contractStatus === "Completed";
        const isFunded = contractFunded;
        agreementData.funded = isFunded;
        agreementData.status = contractStatus;
        agreementData.pendingAcceptance =
          contractStatus === "PendingAcceptance";
        agreementData.awaitingFunding = contractStatus === "AwaitingFunding";
        agreementData.completed = contractStatus === "Completed";

        const balWei =
          await window.contract.getEscrowBalance(currentAgreementId);
        balanceEth = ethers.formatEther(balWei);
        const total = parseFloat(totalEth);
        const bal = parseFloat(balanceEth);
        remainingEth = (total - bal).toFixed(6);
      } catch (e) {
        console.warn(
          "Could not fetch contract data, falling back to DB:",
          e.message,
        );
        // Fallback to DB values
        const isFunded = funded;
        agreementData.funded = isFunded;
        agreementData.status = status;
        agreementData.pendingAcceptance = pendingAcceptance;
        agreementData.awaitingFunding = awaitingFunding;
        agreementData.completed = completed;
        totalEth = agreement.total_amount_eth || "0";
        remainingEth = funded ? "0" : totalEth;
        balanceEth = remainingEth;
      }
    } else {
      agreementData.funded = funded;
      agreementData.status = status;
      agreementData.pendingAcceptance = pendingAcceptance;
      agreementData.awaitingFunding = awaitingFunding;
      agreementData.completed = completed;
      totalEth = agreement.total_amount_eth || "0";
      remainingEth = funded ? "0" : totalEth;
      balanceEth = remainingEth;
    }

    agreementData.totalAmount = totalEth;
    agreementData.remainingAmount = remainingEth;

    updateUI(
      totalEth,
      remainingEth,
      agreementData.funded,
      agreementData.completed,
      agreementData.pendingAcceptance,
      agreementData.awaitingFunding,
      agreementData.status,
    );
    log(
      `✅ Loaded agreement ${currentAgreementId}: ${totalEth} ETH total, ${remainingEth} ETH remaining`,
    );

    const depositBtn = document.getElementById("depositBtn");
    const depositAmtInput = document.getElementById("depositAmt");
    const depositDesc = document.getElementById("depositDesc");

    if (agreementData.pendingAcceptance) {
      depositBtn.disabled = true;
      depositAmtInput.disabled = true;
      depositDesc.textContent = `⏳ Waiting for carrier to accept agreement AGR-${String(currentAgreementId).padStart(4, "0")}.`;
      depositAmtInput.placeholder = "Awaiting acceptance...";
    } else if (agreementData.funded) {
      depositBtn.disabled = true;
      depositAmtInput.disabled = true;
      depositDesc.textContent = `✅ Agreement AGR-${String(currentAgreementId).padStart(4, "0")} is already funded.`;
      depositAmtInput.placeholder = "Already funded";
    } else if (agreementData.awaitingFunding) {
      depositBtn.disabled = false;
      depositAmtInput.disabled = false;
      depositAmtInput.placeholder = `Enter exact amount (${totalEth} ETH)`;
      depositDesc.textContent = `Deposit exactly ${totalEth} ETH into escrow for AGR-${String(currentAgreementId).padStart(4, "0")}.`;
    } else {
      depositBtn.disabled = true;
      depositAmtInput.disabled = true;
      depositDesc.textContent = `⚠️ Agreement is in ${agreementData.status} – deposit not possible.`;
      depositAmtInput.placeholder = "Not available";
    }

    if (window.userWalletAddress && window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const balance = await signer.provider.getBalance(signer.address);
        document.getElementById("walletBalance").textContent =
          ethers.formatEther(balance).slice(0, 10) + " ETH";
      } catch (e) {
        /* ignore */
      }
    }
    await refreshAllAgreements();
  }

  function updateUI(
    total,
    remaining,
    funded,
    completed,
    pendingAcceptance,
    awaitingFunding,
    status,
  ) {
    const el = (id) => document.getElementById(id);
    if (!el) return;
    el("totalEscrow").textContent = total + " ETH";
    el("remainingBalance").textContent = remaining + " ETH";
    el("fundedStatus").innerHTML = funded ? "✅ Yes" : "❌ No";
    let statusText = status;
    if (pendingAcceptance) statusText = "⏳ Pending Acceptance";
    else if (awaitingFunding) statusText = "💰 Awaiting Funding";
    else if (funded && completed) statusText = "✅ Completed";
    else if (funded) statusText = "🟢 Active";
    el("agreementStatus").textContent = statusText;

    const deposited = parseFloat(total) - parseFloat(remaining);
    const percent =
      parseFloat(total) > 0
        ? Math.round((deposited / parseFloat(total)) * 100)
        : 0;
    el("depositProgressFill").style.width = percent + "%";
    el("depositProgressLabel").textContent =
      `${deposited.toFixed(4)} / ${total} ETH deposited`;
    el("depositPercent").textContent = percent + "%";

    el("kvRequired").textContent = total + " ETH";
    el("kvDeposited").textContent = deposited.toFixed(4) + " ETH";
    el("kvRemaining").textContent =
      (parseFloat(total) - deposited).toFixed(4) + " ETH";
    const statusPill = funded ? "lime" : pendingAcceptance ? "amber" : "amber";
    const statusLabel = funded
      ? "✅ Funded"
      : pendingAcceptance
        ? "⏳ Awaiting Acceptance"
        : "⏳ Awaiting Funding";
    el("contractStatus").innerHTML =
      `<span class="pill ${statusPill}"><span class="dot"></span>${statusLabel}</span>`;
    el("balanceDesc").textContent =
      `Live balance for AGR-${String(currentAgreementId).padStart(4, "0")}.`;
  }

  function clearUI() {
    const el = (id) => document.getElementById(id);
    if (!el) return;
    el("totalEscrow").textContent = "—";
    el("remainingBalance").textContent = "—";
    el("fundedStatus").textContent = "—";
    el("agreementStatus").textContent = "—";
    el("kvRequired").textContent = "—";
    el("kvDeposited").textContent = "—";
    el("kvRemaining").textContent = "—";
    el("contractStatus").textContent = "—";
    el("depositProgressFill").style.width = "0%";
    el("depositProgressLabel").textContent = "0 / 0 ETH deposited";
    el("depositPercent").textContent = "0%";
    el("depositDesc").textContent = "Select an agreement to deposit.";
    el("balanceDesc").textContent = "Select an agreement to view balance.";
    el("depositBtn").disabled = true;
    const amt = document.getElementById("depositAmt");
    if (amt) amt.disabled = true;
  }

  function updateDepositPreview() {
    const amt = parseFloat(document.getElementById("depositAmt").value) || 0;
    const total = parseFloat(agreementData.totalAmount) || 0;
    const hint = document.getElementById("depositHint");

    if (agreementData.pendingAcceptance) {
      hint.textContent = "⏳ Awaiting carrier acceptance.";
      hint.style.color = "var(--text-faint)";
      return;
    }
    if (agreementData.funded) {
      hint.textContent = "✅ Agreement already funded.";
      hint.style.color = "var(--lime)";
      return;
    }
    if (!agreementData.awaitingFunding) {
      hint.textContent = "⚠️ Deposit not allowed for this status.";
      hint.style.color = "var(--red)";
      return;
    }

    if (amt > 0) {
      const diff = Math.abs(amt - total);
      if (diff > 0.000001) {
        hint.textContent = `⚠️ Amount must equal ${total.toFixed(4)} ETH exactly.`;
        hint.style.color = "var(--red)";
      } else {
        hint.textContent = `✅ You will deposit exactly ${amt.toFixed(4)} ETH.`;
        hint.style.color = "var(--lime)";
      }
    } else {
      hint.textContent = `Enter exact amount (${total.toFixed(4)} ETH)`;
      hint.style.color = "var(--text-faint)";
    }
  }

  // ─── Deposit function with double-click protection ─────────
  window.doDeposit = async function () {
    if (isProcessing) {
      showToast("Deposit already in progress...", "warning");
      return;
    }
    const amtInput = document.getElementById("depositAmt");
    const amount = parseFloat(amtInput.value);
    if (isNaN(amount) || amount <= 0) {
      showToast("Enter a valid amount.", "error");
      return;
    }
    if (!window.contract) {
      showToast("Contract not available. Please connect your wallet.", "error");
      return;
    }
    if (currentAgreementId === null) {
      showToast("Select an agreement.", "error");
      return;
    }
    if (agreementData.funded) {
      showToast("Agreement already funded.", "error");
      return;
    }
    if (agreementData.pendingAcceptance) {
      showToast("Carrier has not accepted yet.", "error");
      return;
    }
    if (!agreementData.awaitingFunding) {
      showToast("Deposit not available for this status.", "error");
      return;
    }

    const total = parseFloat(agreementData.totalAmount);
    if (Math.abs(amount - total) > 0.000001) {
      showToast(`Amount must be exactly ${total.toFixed(6)} ETH.`, "error");
      return;
    }

    const amountWei = ethers.parseEther(amount.toString());
    log(
      `⏳ Depositing exactly ${amount} ETH to agreement ${currentAgreementId}...`,
    );

    const depositBtn = document.getElementById("depositBtn");
    depositBtn.disabled = true;
    depositBtn.textContent = "Processing...";
    isProcessing = true;

    try {
      const tx = await window.contract.depositEscrow(currentAgreementId, {
        value: amountWei,
        from: window.userWalletAddress,
      });
      log(`📨 Tx sent: ${tx.hash}`);
      await tx.wait();
      log(`✅ Deposit successful!`);
      showToast(`✅ ${amount} ETH deposited successfully!`, "success");

      // ─── Reset button ──────────────────────────────────
      depositBtn.textContent = "Deposit to Escrow";
      depositBtn.disabled = false;

      // ─── Sync with backend ──────────────────────────────
      try {
        await fetch(`/api/escrow/shipper/${currentAgreementId}/deposit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": window.userWalletAddress,
          },
          body: JSON.stringify({
            amount: amountWei.toString(),
            txHash: tx.hash,
          }),
        });
      } catch (e) {
        console.warn("Backend sync failed:", e);
      }

      // ─── Reload UI data ──────────────────────────────────
      await loadAgreementData();
      await refreshAllAgreements();
    } catch (e) {
      log("❌ Deposit failed: " + e.message);
      showToast("❌ Deposit failed: " + e.message, "error");
      depositBtn.textContent = "Deposit to Escrow";
      depositBtn.disabled = false;
    } finally {
      isProcessing = false;
    }
  };

  // ─── Init ──────────────────────────────────────────────────
  async function initDepositBalance() {
    const sel = document.getElementById("agreementSelect");
    if (!sel) {
      console.log("⏭️ Not on deposit page – skipping init.");
      return;
    }
    console.log("🚀 initDepositBalance() called (always reload)");
    // Do NOT auto-connect – just check if contract exists
    if (!window.contract) {
      showToast("Please connect your wallet manually.", "error");
      return;
    }

    sel.removeEventListener("change", loadAgreementData);
    sel.addEventListener("change", loadAgreementData);

    // Always reload data
    await loadAgreements();
  }

  window.addEventListener("walletConnected", async function () {
    if (document.getElementById("agreementSelect")) {
      await initDepositBalance(); // always refresh
    }
  });

  // ─── Expose ──────────────────────────────────────────────
  window.loadAgreementData = loadAgreementData;
  window.loadAgreements = loadAgreements;
  window.updateDepositPreview = updateDepositPreview;
  window.initDepositBalance = initDepositBalance;
  window.debugInit = initDepositBalance;
  window.doDeposit = window.doDeposit;

  console.log("✅ deposit_balance.js ready – always reloads on init.");
})();
