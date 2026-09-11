let currentAgreementId = null;
let currentAgreementData = null;
let refundLog = [];

function log(msg) {
  console.log(`[Refund Centre] ${msg}`);

  const el = document.getElementById("output");

  if (el) {
    el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
    el.scrollTop = el.scrollHeight;
  }
}

// ─── Load Agreements for dropdown ──────────────────────────
async function loadAgreements() {
  console.log("========== REFUND DEBUG ==========");
  console.log("🚀 loadAgreements() CALLED");
  console.log("window.userWalletAddress:", window.userWalletAddress);
  console.log("window.contract:", window.contract);
  console.log("agreementSelect:", document.getElementById("agreementSelect"));

  try {
    console.log("📡 Calling /api/agreements...");
    console.log("📡 Wallet header:", window.userWalletAddress || "");

    const token = localStorage.getItem("traxenAuthToken");

    if (!token) {
      throw new Error("Authentication token required.");
    }

    const res = await fetch("/api/agreements", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("📡 API response status:", res.status);
    console.log("📡 API response OK:", res.ok);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ API ERROR:", errorText);
      throw new Error("Failed to fetch agreements");
    }

    const data = await res.json();

    console.log("📦 API returned:", data);
    console.log("📦 Number of agreements:", data.length);

    const expiredAgreements = [];

    // Check every agreement belonging to this shipper
    console.log("🔍 Starting expiry check...");

    for (const ag of data) {
      try {
        console.log("────────────────────────");
        console.log("📋 Checking agreement:", ag.onchain_id);
        console.log("📋 Status:", ag.status);
        console.log("📋 Deadline:", ag.deadline);
        const deadline = new Date(ag.deadline);
        const now = new Date();

        const isPastDeadline = now > deadline;
        const isActive =
          ag.status === "Active" || ag.status === "AwaitingFunding";
        console.log("⏰ Deadline date:", deadline);
        console.log("⏰ Current time:", now);
        console.log("⏰ Is past deadline:", isPastDeadline);
        console.log("📌 Is active:", isActive);
        // Deadline passed → expired for refund purposes
        if (isPastDeadline && isActive) {
          console.log("🚨 EXPIRED AGREEMENT FOUND:", ag.onchain_id);

          log(`⚠️ Agreement ${ag.onchain_id} has passed its deadline.`);

          // The deployed contract does not contain markExpired().
          // refund() checks the deadline directly on-chain.
          ag.status = "Expired";

          console.log("📌 Local status changed to:", ag.status);
          log(`✅ Agreement ${ag.onchain_id} is eligible for refund.`);
        }

        // Only display agreements that are actually Expired
        if (ag.status === "Expired") {
          expiredAgreements.push(ag);
        }
      } catch (error) {
        console.error(`Error checking agreement ${ag.onchain_id}:`, error);
      }
    }

    // Render only expired agreements
    renderExpiryGrid(expiredAgreements);

    // No agreement selected initially
    currentAgreementId = null;

    return expiredAgreements;
  } catch (e) {
    log("❌ Failed to load agreements: " + e.message);
    return [];
  }
}

// ─── Render Expiry Grid ────────────────────────────────────
function renderExpiryGrid(agreements) {
  const container = document.getElementById("expiryGrid");

  if (!agreements || agreements.length === 0) {
    container.innerHTML = `
      <div style="color:var(--text-faint);padding:20px 0;">
        No expired agreements.
      </div>
    `;
    return;
  }

  container.innerHTML = agreements
    .map((ag) => {
      const deadline = ag.deadline
        ? new Date(ag.deadline).toLocaleString()
        : "—";

      const amount =
        ag.escrow_amount != null
          ? ethers.formatEther(String(ag.escrow_amount))
          : ag.total_amount || "0";

      return `
      <div
        class="expiry-card expired"
        onclick="selectAgreement(${ag.onchain_id})"        
        style="cursor:pointer;"
      >
        <div class="pill red" style="margin-bottom:8px;">
          <span class="dot"></span>
          Expired
        </div>

        <div style="font-weight:700;">
          AGR-${String(ag.onchain_id).padStart(4, "0")}
        </div>

        <div style="font-size:12px;color:var(--text-faint);margin-top:6px;">
          Deadline: ${deadline}
        </div>

        <div style="font-size:12px;color:var(--text-faint);margin-top:4px;">
          Remaining: ${amount} ETH
        </div>
      </div>
    `;
    })
    .join("");
}

async function selectAgreement(id) {
  currentAgreementId = id;
  await loadRefundData();
}

// ─── Load Refund Data ──────────────────────────────────────
async function loadRefundData() {
  if (currentAgreementId === null) {
    document.getElementById("agreementDesc").textContent =
      "Select an expired agreement below to review the refund.";
    return;
  }

  if (!window.contract) {
    showToast("⚠️ Connect wallet first.", "error");
    return;
  }

  try {
    // Get agreement details from contract
    const details = await window.contract.getAgreement(currentAgreementId);

    const shipper = details[1];
    const carrier = details[2];

    const totalAmount = ethers.formatEther(details[3]);
    const releasedAmount = ethers.formatEther(details[4]);

    const remainingAmount = ethers.formatEther(details[3] - details[4]);

    const deadline = new Date(Number(details[5]) * 1000);
    const status = Number(details[6]);

    const funded = details[3] > 0n;
    const completed = status === 3;

    currentAgreementData = {
      shipper,
      carrier,
      totalAmount,
      remainingAmount,
      funded,
      completed,
      deadline,
      status,
    };

    // Get milestone data
    const milestoneCount = Number(
      await window.contract.getMilestoneCount(currentAgreementId),
    );

    const milestones = [];

    for (let i = 0; i < milestoneCount; i++) {
      const m = await window.contract.getMilestone(currentAgreementId, i);

      milestones.push({
        verified: m[2],
        paid: m[3],
      });
    }

    const allPaid = milestones.length > 0 && milestones.every((m) => m.paid);

    // Update UI
    updateRefundUI(
      currentAgreementId,
      totalAmount,
      remainingAmount,
      funded,
      completed,
      deadline,
      status,
      allPaid,
    );

    log(`✅ Loaded refund data for agreement ${currentAgreementId}`);
  } catch (e) {
    log("❌ Error loading refund data: " + e.message);
    showToast("❌ Error loading agreement: " + e.message, "error");
  }
}

function updateRefundUI(
  agreementId,
  total,
  remaining,
  funded,
  completed,
  deadline,
  status,
  allPaid,
) {
  const now = new Date();
  const isExpired = now > deadline;
  const hasBalance = parseFloat(remaining) > 0;
  const isRefundable = isExpired && hasBalance && funded && !completed;

  // Agreement description
  document.getElementById("agreementDesc").textContent =
    `AGR-${String(agreementId).padStart(4, "0")} — ${funded ? "✅ Funded" : "⏳ Not Funded"} | ${completed ? "✅ Completed" : "⏳ In Progress"}`;

  // Deadline
  document.getElementById("deadlineDisplay").textContent =
    deadline.toLocaleString();
  document.getElementById("agreementIdDisplay").textContent =
    `AGR-${String(agreementId).padStart(4, "0")}`;

  document.getElementById("totalAmountDisplay").textContent = total + " ETH";

  document.getElementById("releasedAmountDisplay").textContent =
    parseFloat(total) - parseFloat(remaining) + " ETH";

  document.getElementById("refundAmountDisplay").textContent =
    remaining + " ETH";
  // Expiry status
  const statusLabel = isExpired
    ? hasBalance
      ? "Expired ⚠️"
      : "Expired ✅"
    : "On Track";

  const statusClass = isExpired ? (hasBalance ? "amber" : "lime") : "lime";

  document.getElementById("expiryStatusDisplay").innerHTML =
    `<span class="pill ${statusClass}">
    <span class="dot"></span>${statusLabel}
  </span>`;

  // Remaining locked
  document.getElementById("remainingLockedDisplay").textContent =
    remaining + " ETH";

  // Refund button
  const btn = document.getElementById("refundBtn");
  if (isRefundable && !completed) {
    btn.disabled = false;
    btn.textContent = `↩ Request Refund (${remaining} ETH)`;
  } else {
    btn.disabled = true;
    if (completed) btn.textContent = "✅ Agreement Completed";
    else if (!funded) btn.textContent = "⏳ Agreement Not Funded";
    else if (!isExpired) btn.textContent = "⏳ Deadline Not Passed";
    else if (!hasBalance) btn.textContent = "✅ No Balance to Refund";
    else btn.textContent = "↩ Refund Unavailable";
  }

  // Banner
  const banner = document.getElementById("refundBanner");
  if (isRefundable && !completed) {
    banner.innerHTML = `
        <div class="banner warn">
          <div class="banner-icon">⚠️</div>
          <div><strong>Refund available.</strong> The deadline has passed and there is ${remaining} ETH remaining in escrow. Click "Request Refund" to reclaim your funds.</div>
        </div>
      `;
  } else if (isExpired && !hasBalance) {
    banner.innerHTML = `
        <div class="banner ok">
          <div class="banner-icon">✅</div>
          <div><strong>No balance to refund.</strong> All funds have been released.</div>
        </div>
      `;
  } else if (completed) {
    banner.innerHTML = `
        <div class="banner ok">
          <div class="banner-icon">✅</div>
          <div><strong>Agreement completed.</strong> All milestones have been paid.</div>
        </div>
      `;
  } else {
    banner.innerHTML = `
        <div class="banner info">
          <div class="banner-icon">ℹ</div>
          <div><strong>Agreement active.</strong> Deadline: ${deadline.toLocaleString()} | Remaining: ${remaining} ETH</div>
        </div>
      `;
  }
}

// ─── Handle Refund ─────────────────────────────────────────
window.handleRefund = async function () {
  if (!window.contract) {
    showToast("Connect wallet first!", "error");
    return;
  }
  if (currentAgreementId === null) {
    showToast("No agreement selected.", "error");
    return;
  }
  if (!currentAgreementData) {
    showToast("Agreement data not loaded.", "error");
    return;
  }

  const { remainingAmount, deadline } = currentAgreementData;
  const now = new Date();
  if (now < deadline) {
    showToast("❌ Deadline not passed yet.", "error");
    return;
  }
  if (parseFloat(remainingAmount) <= 0) {
    showToast("❌ No balance to refund.", "error");
    return;
  }

  if (
    !confirm(
      `Are you sure you want to refund ${remainingAmount} ETH to the Shipper?`,
    )
  )
    return;

  log(`⏳ Requesting refund for agreement ${currentAgreementId}...`);
  try {
    const tx = await window.contract.refund(currentAgreementId);
    log(`📨 Tx sent: ${tx.hash}`);
    await tx.wait();
    log(`✅ Refund successful!`);

    // ═══ YON — HISTORY MODULE ═══
    // Record the refund in the backend so it appears in transaction history.
    try {
      const token = localStorage.getItem("traxenAuthToken");

      const refundResponse = await fetch(
        `/api/escrow/shipper/${currentAgreementId}/refund`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            txHash: tx.hash,
          }),
        },
      );
      if (!refundResponse.ok) {
        const errData = await refundResponse.json().catch(() => ({}));
        log(
          "⚠️ Refund recorded on-chain but history record failed: " +
            (errData.error || refundResponse.status),
        );
      } else {
        log("📦 Refund recorded in history.");
      }
    } catch (recordError) {
      log("⚠️ Refund history record failed: " + recordError.message);
    }
    // ═══ YON End ═══

    showToast(
      `✅ Refund successful! ${remainingAmount} ETH returned.`,
      "success",
    );

    // Update local refund log
    refundLog.unshift({
      agreementId: currentAgreementId,
      amount: remainingAmount,
      txHash: tx.hash,
      time: new Date().toLocaleString(),
    });
    renderRefundLog();

    // Refresh data
    await loadRefundData();
  } catch (e) {
    log("❌ Refund failed: " + e.message);
    showToast("❌ Refund failed: " + e.message, "error");
  }
};

function renderRefundLog() {
  const container = document.getElementById("refundLog");
  if (!refundLog || refundLog.length === 0) {
    container.innerHTML =
      '<div style="color:var(--text-faint);font-size:12px;">No refunds recorded yet.</div>';
    return;
  }
  container.innerHTML = refundLog
    .map(
      (entry) => `
      <div class="log-row">
        <div class="log-icon refund">↩</div>
        <div class="log-main">
          <div class="log-title">Refund executed — AGR-${String(entry.agreementId).padStart(4, "0")}</div>
          <div class="log-sub">tx ${truncateHash(entry.txHash)} · ${entry.amount} ETH → Shipper</div>
        </div>
        <div class="log-time">${entry.time}</div>
      </div>
    `,
    )
    .join("");
}

function truncateHash(hash) {
  if (!hash) return "";
  if (hash.length <= 10) return hash;
  return hash.slice(0, 6) + "…" + hash.slice(-4);
}

// ─── Wallet Events ────────────────────────────────────────
window.addEventListener("walletConnected", () => {
  window.initRefundExpiry();
});

// Expose for inline onclick
window.loadRefundData = loadRefundData;
window.loadAgreements = loadAgreements;

window.initRefundExpiry = async function () {
  console.log("🚀 initRefundExpiry() called");

  const expiryGrid = document.getElementById("expiryGrid");

  if (!expiryGrid) {
    console.warn("⚠️ expiryGrid is missing from current Refund Centre DOM.");
    return;
  }

  console.log("✅ Refund Centre DOM ready.");

  await loadAgreements();
  await loadRefundData();
};
