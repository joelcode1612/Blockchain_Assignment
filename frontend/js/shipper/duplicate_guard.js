let currentAgreementId = null;
let currentMilestones = [];
let duplicateAttempts = 0;
let attemptLog = [];

function log(msg) {
  const el = document.getElementById("output");
  el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
  el.scrollTop = el.scrollHeight;
}

function authHeaders(extra = {}) {
  const token =
    window.Auth?.getToken?.() ||
    window.Session?.getToken?.() ||
    localStorage.getItem("traxenToken") ||
    sessionStorage.getItem("traxenToken");

  const headers = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// ─── Load Agreements for dropdown ──────────────────────────
async function loadAgreements() {
  try {
    const res = await fetch("/api/agreements", {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch agreements");
    const data = await res.json();
    const sel = document.getElementById("agreementSelect");
    sel.innerHTML = '<option value="">— Select —</option>';
    data.forEach((ag) => {
      const opt = document.createElement("option");
      opt.value = ag.onchain_id;
      opt.textContent = `AGR-${String(ag.onchain_id).padStart(4, "0")} (${ag.status})`;
      sel.appendChild(opt);
    });
    if (data.length > 0) {
      sel.value = data[0].onchain_id;
      loadMilestones();
    }
    return data;
  } catch (e) {
    log("❌ Failed to load agreements: " + e.message);
    return [];
  }
}

// ─── Load Milestones from Contract ──────────────────────────
async function loadMilestones() {
  const sel = document.getElementById("agreementSelect");
  const id = parseInt(sel.value);
  currentAgreementId = isNaN(id) ? null : id;

  if (currentAgreementId === null) {
    document.getElementById("milestoneStatusContainer").innerHTML =
      '<div style="color:var(--text-faint);padding:12px 0;">Select an agreement to view milestones.</div>';
    document.getElementById("dupMilestone").innerHTML =
      '<option value="">— Select a milestone —</option>';
    return;
  }

  if (!window.contract) {
    document.getElementById("milestoneStatusContainer").innerHTML =
      '<div style="color:var(--text-faint);padding:12px 0;">⚠️ Connect wallet first.</div>';
    return;
  }

  try {
    const agreementData = await window.contract.agreements(currentAgreementId);
    const milestoneCount = Number(agreementData.milestoneCount);

    const milestones = [];
    for (let i = 0; i < milestoneCount; i++) {
      const m = await window.contract.getMilestone(currentAgreementId, i);
      milestones.push({
        id: i,
        description: m[0] || `Milestone ${i + 1}`,
        percentage: Number(m[1]),
        verified: m[2],
        paid: m[3],
      });
    }
    currentMilestones = milestones;

    // Update milestone status table
    renderMilestoneStatus(milestones);

    // Populate dropdown for simulation
    const dupSel = document.getElementById("dupMilestone");
    dupSel.innerHTML = '<option value="">— Select a milestone —</option>';
    milestones.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.description} (${m.paid ? "Already paid" : m.verified ? "Verified, not paid" : "Pending"})`;
      dupSel.appendChild(opt);
    });

    log(
      `✅ Loaded ${milestones.length} milestones for agreement ${currentAgreementId}`,
    );
  } catch (e) {
    log("❌ Error loading milestones: " + e.message);
    document.getElementById("milestoneStatusContainer").innerHTML =
      `<div style="color:var(--text-faint);padding:12px 0;">❌ Error: ${e.message}</div>`;
  }
}

function renderMilestoneStatus(milestones) {
  const container = document.getElementById("milestoneStatusContainer");
  if (!milestones || milestones.length === 0) {
    container.innerHTML =
      '<div style="color:var(--text-faint);padding:12px 0;">No milestones defined.</div>';
    return;
  }

  let rows = milestones
    .map((m) => {
      let status = m.paid ? "Paid ✅" : m.verified ? "Verified" : "Pending";
      let statusClass = m.paid ? "lime" : m.verified ? "amber" : "gray";
      return `
        <tr>
          <td>${m.id + 1}</td>
          <td>${m.description}</td>
          <td>${m.percentage}%</td>
          <td><span class="pill ${statusClass}"><span class="dot"></span>${status}</span></td>
          <td>${m.paid ? "🔒 Guard active" : m.verified ? "Can release" : "—"}</td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
      <table>
        <thead><tr><th>#</th><th>Milestone</th><th>%</th><th>Status</th><th>Guard State</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
}

// ─── Simulate Duplicate Attempt ────────────────────────────
window.simulateDuplicate = async function () {
  const sel = document.getElementById("dupMilestone");
  const milestoneId = parseInt(sel.value);
  if (isNaN(milestoneId)) {
    showToast("Select a milestone first.", "error");
    return;
  }

  if (!window.contract) {
    showToast("Connect wallet first.", "error");
    return;
  }

  if (currentAgreementId === null) {
    showToast("Select an agreement.", "error");
    return;
  }

  const milestone = currentMilestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    showToast("Milestone not found.", "error");
    return;
  }

  const resultDiv = document.getElementById("dupResult");

  // If already paid, we expect the contract to revert with "Already released"
  if (milestone.paid) {
    // Try to call releasePayment – it should revert
    try {
      log(
        `⏳ Attempting duplicate release for milestone ${milestoneId} (already paid)...`,
      );
      await window.contract.releasePayment(currentAgreementId, milestoneId);
      // If it somehow succeeds (shouldn't happen), log it
      log("⚠️ Unexpected: release succeeded on already-paid milestone!");
      showToast("⚠️ Unexpected success!", "info");
      resultDiv.innerHTML =
        '<div class="banner ok" style="margin:0;"><div class="banner-icon">⚠️</div><div><strong>Unexpected success.</strong> The contract allowed release on an already-paid milestone. This should not happen.</div></div>';
    } catch (e) {
      // Expected revert – check if the revert reason is "Already released"
      if (e.reason && e.reason.includes("Already released")) {
        log(
          '✅ Duplicate guard blocked the attempt (reverted: "Already released")',
        );
        showToast("✅ Guard blocked duplicate payment!", "success");
        resultDiv.innerHTML =
          '<div class="banner ok" style="margin:0;"><div class="banner-icon">🛡</div><div><strong>Guard blocked.</strong> Transaction reverted with reason: "Already released". No funds were transferred.</div></div>';
        duplicateAttempts++;
        document.getElementById("duplicateCount").textContent =
          duplicateAttempts;
        addAttemptLog(
          "Blocked",
          `Duplicate release blocked — Milestone ${milestoneId} (${milestone.description})`,
          e.reason,
        );
      } else {
        // Some other error
        log("❌ Error during duplicate attempt: " + e.message);
        showToast("❌ Error: " + e.message, "error");
        resultDiv.innerHTML = `<div class="banner danger" style="margin:0;"><div class="banner-icon">✕</div><div><strong>Error:</strong> ${e.message}</div></div>`;
        addAttemptLog("Error", `Error on milestone ${milestoneId}`, e.message);
      }
    }
  } else {
    // Milestone is not paid – we can actually release it (if verified)
    if (milestone.verified) {
      // Confirm with user
      if (
        !confirm(
          `This milestone is verified but not yet paid. Do you want to release it now?`,
        )
      )
        return;
      try {
        log(`⏳ Releasing payment for milestone ${milestoneId}...`);
        const tx = await window.contract.releasePayment(
          currentAgreementId,
          milestoneId,
        );
        await tx.wait();
        log(`✅ Payment released for milestone ${milestoneId}`);
        showToast("✅ Payment released!", "success");
        resultDiv.innerHTML =
          '<div class="banner ok" style="margin:0;"><div class="banner-icon">✓</div><div><strong>Payment released successfully.</strong> The milestone is now marked as paid.</div></div>';
        addAttemptLog(
          "Released",
          `Milestone ${milestoneId} (${milestone.description}) released`,
          tx.hash,
        );
        // Reload milestones to update status
        await loadMilestones();
      } catch (e) {
        log("❌ Release failed: " + e.message);
        showToast("❌ Release failed: " + e.message, "error");
        resultDiv.innerHTML = `<div class="banner danger" style="margin:0;"><div class="banner-icon">✕</div><div><strong>Release failed:</strong> ${e.message}</div></div>`;
        addAttemptLog(
          "Error",
          `Release failed on milestone ${milestoneId}`,
          e.message,
        );
      }
    } else {
      // Not verified, can't release
      showToast("❌ Milestone is not verified. Cannot release.", "error");
      resultDiv.innerHTML =
        '<div class="banner danger" style="margin:0;"><div class="banner-icon">✕</div><div><strong>Cannot release.</strong> Milestone must be verified first.</div></div>';
      addAttemptLog(
        "Blocked",
        `Attempt to release unverified milestone ${milestoneId}`,
        "Not verified",
      );
    }
  }
};

function addAttemptLog(type, title, detail) {
  const entry = {
    type: type,
    title: title,
    detail: detail,
    time: new Date().toLocaleString(),
  };
  attemptLog.unshift(entry);
  renderAttemptLog();
}

function renderAttemptLog() {
  const container = document.getElementById("attemptLog");
  if (!attemptLog || attemptLog.length === 0) {
    container.innerHTML =
      '<div style="color:var(--text-faint);font-size:12px;">No attempts yet.</div>';
    return;
  }
  container.innerHTML = attemptLog
    .map((entry) => {
      const icon =
        entry.type === "Blocked"
          ? "blocked"
          : entry.type === "Released"
            ? "ok"
            : "";
      const iconClass =
        entry.type === "Blocked"
          ? "blocked"
          : entry.type === "Released"
            ? "ok"
            : "";
      return `
        <div class="log-row">
          <div class="log-icon ${iconClass}">${icon === "blocked" ? "✕" : icon === "ok" ? "✓" : "ℹ"}</div>
          <div class="log-main">
            <div class="log-title">${entry.title}</div>
            <div class="log-sub">${entry.detail}</div>
          </div>
          <div class="log-time">${entry.time}</div>
        </div>
      `;
    })
    .join("");
}

// ─── Wallet Events ────────────────────────────────────────
window.addEventListener("walletConnected", () => {
  loadAgreements().then(() => loadMilestones());
});

// ─── Init ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (window.userWalletAddress) {
    await loadAgreements();
    await loadMilestones();
  } else {
    log("👛 Connect wallet to start.");
    window.addEventListener("walletConnected", async () => {
      await loadAgreements();
      await loadMilestones();
    });
  }
});

// Expose for inline onclick
window.loadMilestones = loadMilestones;
window.loadAgreements = loadAgreements;
