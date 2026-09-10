// ─── Milestone Release Logic (IIFE, no global variable pollution) ──
console.log("🚀 milestone_release.js loaded");

(function () {
  // ─── Private state ──────────────────────────────────────
  let currentAgreementId = null;
  let allAgreements = [];
  let currentMilestones = [];
  let releaseLog = [];

  function log(msg) {
    const el = document.getElementById("output");
    if (el) el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
  }

  // ─── Load Agreements from API ──────────────────────────
  async function loadAgreements() {
    console.log("🔍 loadAgreements called");
    try {
      const address = window.userWalletAddress;
      if (!address) {
        console.warn("⚠️ No wallet address");
        return [];
      }
      const token = localStorage.getItem("traxenAuthToken");

      if (!token) {
        throw new Error("Authentication token required.");
      }

      const res = await fetch("/api/agreements", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
        opt.textContent = `AGR-${String(ag.onchain_id).padStart(4, "0")} (${ag.status})`;
        sel.appendChild(opt);
      });
      if (allAgreements.length > 0) {
        sel.value = allAgreements[0].onchain_id;
        await loadMilestones();
      }
      return allAgreements;
    } catch (e) {
      console.error("❌ loadAgreements error:", e);
      log("❌ Failed to load agreements: " + e.message);
      return [];
    }
  }

  // ─── Load Milestones from Contract ──────────────────────
  async function loadMilestones() {
    console.log("🔍 loadMilestones called");
    const sel = document.getElementById("agreementSelect");
    if (!sel) return;
    const id = parseInt(sel.value);
    currentAgreementId = isNaN(id) ? null : id;

    function safeSetHTML(id, html) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    }

    if (currentAgreementId === null) {
      safeSetHTML(
        "milestoneTableContainer",
        '<div style="color:var(--text-faint);padding:12px 0;">Select an agreement to view milestones.</div>',
      );
      const desc = document.getElementById("agreementDesc");
      if (desc) desc.textContent = "Select an agreement to view milestones.";
      clearStats();
      return;
    }

    if (!window.contract) {
      safeSetHTML(
        "milestoneTableContainer",
        '<div style="color:var(--text-faint);padding:12px 0;">⚠️ Connect wallet first.</div>',
      );
      return;
    }

    try {
      const agreement = await window.contract.getAgreement(currentAgreementId);
      const totalWei = agreement[3];
      const totalEth = ethers.formatEther(totalWei);
      const releasedWei = agreement[4];
      const releasedEth = ethers.formatEther(releasedWei);
      const statusNum = Number(agreement[6]);
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
      const statusText = statusNames[statusNum] || "Unknown";
      const isActive = statusNum === 2;

      const milestoneCount = Number(agreement[10]);
      const milestones = [];
      for (let i = 0; i < milestoneCount; i++) {
        const m = await window.contract.getMilestone(currentAgreementId, i);
        const statusVal = Number(m[2]);
        milestones.push({
          id: i,
          description: m[6] || `Milestone ${i + 1}`,
          percentage: Number(m[1]),
          verified: statusVal >= 2,
          paid: statusVal === 3,
          status: statusVal,
          submittedAt: Number(m[3]),
          verifiedAt: Number(m[4]),
          paidAt: Number(m[5]),
        });
      }
      currentMilestones = milestones;

      updateStats(totalEth, releasedEth, milestones, isActive);
      const desc = document.getElementById("agreementDesc");
      if (desc)
        desc.textContent = `Agreement AGR-${String(currentAgreementId).padStart(4, "0")} — ${statusText}`;
      renderMilestones(milestones, totalEth);

      log(
        `✅ Loaded ${milestones.length} milestones for agreement ${currentAgreementId}`,
      );
    } catch (e) {
      console.error("❌ loadMilestones error:", e);
      log("❌ Error loading milestones: " + e.message);
      safeSetHTML(
        "milestoneTableContainer",
        `<div style="color:var(--text-faint);padding:12px 0;">❌ Error: ${e.message}</div>`,
      );
    }
  }

  function updateStats(totalEth, releasedEth, milestones, isActive) {
    const paid = milestones.filter((m) => m.paid).length;
    const total = milestones.length;
    const remainingEth = parseFloat(totalEth) - parseFloat(releasedEth);
    const nextMilestone = milestones.find((m) => m.verified && !m.paid);

    function setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    setText("totalEscrow", totalEth + " ETH");
    setText("releasedSoFar", releasedEth + " ETH");
    setText("remainingLocked", remainingEth.toFixed(4) + " ETH");
    setText(
      "nextRelease",
      nextMilestone
        ? `${nextMilestone.description} — ${((parseFloat(totalEth) * nextMilestone.percentage) / 100).toFixed(4)} ETH`
        : "All paid ✅",
    );
    setText("summaryTotal", totalEth + " ETH");
    setText("summaryReleased", releasedEth + " ETH");
    setText("summaryRemaining", remainingEth.toFixed(4) + " ETH");
    setText(
      "summaryNext",
      nextMilestone
        ? `${nextMilestone.description} — ${((parseFloat(totalEth) * nextMilestone.percentage) / 100).toFixed(4)} ETH`
        : "All paid ✅",
    );
  }

  function renderMilestones(milestones, totalEth) {
    const container = document.getElementById("milestoneTableContainer");
    if (!container) return;
    if (!milestones || milestones.length === 0) {
      container.innerHTML =
        '<div style="color:var(--text-faint);padding:12px 0;">No milestones defined for this agreement.</div>';
      return;
    }

    let rows = milestones
      .map((m) => {
        const payout = ((parseFloat(totalEth) * m.percentage) / 100).toFixed(4);
        let statusText = "Pending";
        let statusClass = "gray";
        let action = "—";

        if (m.paid) {
          statusText = "Paid";
          statusClass = "lime";
          action =
            '<span style="color:var(--lime);font-weight:700;">✅ Paid</span>';
        } else if (m.verified) {
          statusText = "Verified";
          statusClass = "amber";
          if (window.contract) {
            action = `<button class="btn btn-primary btn-sm" onclick="window.releaseMilestone(${m.id})">Release</button>`;
          }
        } else if (m.status === 1) {
          // Submitted
          statusText = "Submitted";
          statusClass = "blue";
          if (window.contract) {
            action = `<button class="btn btn-secondary btn-sm" onclick="window.verifyMilestone(${m.id})">Verify</button>`;
          }
        } else {
          statusText = "Pending";
          statusClass = "gray";
          action = "—";
        }

        return `
        <tr>
          <td>${m.id + 1}</td>
          <td>${m.description}</td>
          <td>${m.percentage}%</td>
          <td>${payout} ETH</td>
          <td class="mono">—</td>
          <td><span class="pill ${statusClass}"><span class="dot"></span>${statusText}</span></td>
          <td>${action}</td>
        </tr>
      `;
      })
      .join("");

    container.innerHTML = `
      <table>
        <thead><tr><th>#</th><th>Milestone</th><th>%</th><th>Payout</th><th>Verification</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ─── Verify Milestone (Shipper only) ────────────────────
  async function verifyMilestone(milestoneId) {
    if (!window.contract) {
      showToast("Connect wallet first!", "error");
      return;
    }
    if (currentAgreementId === null) {
      showToast("No agreement selected.", "error");
      return;
    }
    const milestone = currentMilestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      showToast("Milestone not found.", "error");
      return;
    }
    if (milestone.status !== 1) {
      showToast("Milestone is not in Submitted state.", "error");
      return;
    }

    log(`⏳ Verifying milestone ${milestoneId}...`);
    try {
      const tx = await window.contract.verifyMilestone(
        currentAgreementId,
        milestoneId,
      );
      log(`📨 Tx sent: ${tx.hash}`);
      await tx.wait();
      log(`✅ Milestone ${milestoneId} verified.`);
      showToast("✅ Milestone verified successfully!", "success");

      // Sync with backend (optional)
      try {
        const token = localStorage.getItem("traxenAuthToken");
        await fetch("/api/milestones/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            agreementId: currentAgreementId,
            milestoneId: milestoneId,
            txHash: tx.hash,
          }),
        });
      } catch (e) {
        console.warn("Backend sync failed:", e);
      }

      await loadMilestones();
    } catch (e) {
      log("❌ Verify failed: " + e.message);
      showToast("❌ Verify failed: " + e.message, "error");
    }
  }

  // ─── Release Milestone ──────────────────────────────────
  async function releaseMilestone(milestoneId) {
    if (!window.contract) {
      showToast("Connect wallet first!", "error");
      return;
    }
    if (currentAgreementId === null) {
      showToast("No agreement selected.", "error");
      return;
    }
    const milestone = currentMilestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      showToast("Milestone not found.", "error");
      return;
    }
    if (milestone.paid) {
      showToast("Already paid.", "error");
      return;
    }
    if (!milestone.verified) {
      showToast("Milestone not verified yet.", "error");
      return;
    }

    log(`⏳ Releasing payment for milestone ${milestoneId}...`);
    try {
      const tx = await window.contract.releasePayment(
        currentAgreementId,
        milestoneId,
      );
      log(`📨 Tx sent: ${tx.hash}`);
      await tx.wait();
      log(`✅ Payment released for milestone ${milestoneId}`);
      showToast("✅ Payment released successfully!", "success");

      try {
        const token = localStorage.getItem("traxenAuthToken");
        await fetch("/api/payment/release", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            agreementId: currentAgreementId,
            milestoneId: milestoneId,
            txHash: tx.hash,
          }),
        });
      } catch (e) {
        console.warn("Backend sync failed:", e);
      }

      const totalEth = await window.contract
        .getAgreement(currentAgreementId)
        .then((a) => ethers.formatEther(a[3]));
      const payout = (
        (parseFloat(totalEth) * milestone.percentage) /
        100
      ).toFixed(4);
      releaseLog.unshift({
        title: `Milestone ${milestoneId + 1} — ${milestone.description} released`,
        amount: payout + " ETH → Carrier",
        time: new Date().toLocaleString(),
      });
      renderReleaseLog();
      await loadMilestones();
    } catch (e) {
      log("❌ Release failed: " + e.message);
      showToast("❌ Release failed: " + e.message, "error");
    }
  }

  function renderReleaseLog() {
    const container = document.getElementById("releaseLog");
    if (!container) return;
    if (!releaseLog || releaseLog.length === 0) {
      container.innerHTML =
        '<div style="color:var(--text-faint);font-size:12px;">No releases yet.</div>';
      return;
    }
    container.innerHTML = releaseLog
      .map(
        (entry) => `
      <div class="log-row">
        <div class="log-icon ok">✓</div>
        <div class="log-main">
          <div class="log-title">${entry.title}</div>
          <div class="log-sub">${entry.amount}</div>
        </div>
        <div class="log-time">${entry.time}</div>
      </div>
    `,
      )
      .join("");
  }

  function clearStats() {
    const ids = [
      "totalEscrow",
      "releasedSoFar",
      "remainingLocked",
      "nextRelease",
      "summaryTotal",
      "summaryReleased",
      "summaryRemaining",
      "summaryNext",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    });
  }

  // ─── Init ────────────────────────────────────────────────
  async function initMilestoneRelease() {
    console.log("🚀 initMilestoneRelease() called");

    try {
      // --------------------------------------------------
      // 1. Make sure the application authentication session
      //    is still valid.
      // --------------------------------------------------
      if (window.Auth && typeof window.Auth.ensureFullSession === "function") {
        const authenticated = await window.Auth.ensureFullSession();

        if (!authenticated) {
          console.warn("⚠️ Full session validation failed.");
          return;
        }
      }

      // --------------------------------------------------
      // 2. Restore / validate Web3 session.
      // --------------------------------------------------
      if (typeof window.ensureWeb3Ready === "function") {
        const web3Ready = await window.ensureWeb3Ready();

        if (!web3Ready || !window.contract) {
          console.warn("⚠️ Web3 session is not ready.");
          showToast("Please connect your wallet first.", "error");
          return;
        }
      } else if (!window.contract) {
        console.warn("⚠️ window.contract not available.");
        showToast("Please connect your wallet first.", "error");
        return;
      }

      // --------------------------------------------------
      // 3. Get the authenticated wallet.
      // --------------------------------------------------
      const wallet =
        window.userWalletAddress || localStorage.getItem("traxenWallet");

      if (!wallet) {
        console.warn("⚠️ Authenticated wallet not available.");
        showToast("Please login first.", "error");
        return;
      }

      // Keep global wallet synchronized for this page.
      window.userWalletAddress = wallet;

      // --------------------------------------------------
      // 4. Attach agreement selector listener.
      // --------------------------------------------------
      const sel = document.getElementById("agreementSelect");

      if (sel) {
        sel.removeEventListener("change", loadMilestones);
        sel.addEventListener("change", loadMilestones);
      }

      // --------------------------------------------------
      // 5. Load fresh data.
      // --------------------------------------------------
      await loadAgreements();

      // loadAgreements() already calls loadMilestones()
      // when an agreement exists, so no need to call it twice.

      console.log("✅ Milestone Release initialized successfully.");
    } catch (error) {
      console.error("❌ initMilestoneRelease error:", error);
      showToast("Unable to initialize milestone release page.", "error");
    }
  }

  // ─── Expose public functions ────────────────────────────
  window.loadMilestones = loadMilestones;
  window.loadAgreements = loadAgreements;
  window.verifyMilestoneFromRelease = verifyMilestone;
  window.releaseMilestone = releaseMilestone;
  window.initMilestoneRelease = initMilestoneRelease;
  window.debugInit = initMilestoneRelease;

  // ─── Auto‑init ───────────────────────────────────────────

  console.log("✅ milestone_release.js ready – always refreshes on init.");
})();
