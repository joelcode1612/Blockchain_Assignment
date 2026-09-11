(function () {
  let currentAgreement = null;
  let milestoneActionInProgress = false;

  // ─── Init function called by the SPA router ──────────────
  window.initAgreementDetails = async function () {
    try {
      // 1. Get agreement ID from URL
      const params = new URLSearchParams(window.location.search);
      const agreementId = params.get("id");
      if (!agreementId) {
        showError("No agreement ID provided.");
        return;
      }

      // 2. Fetch agreement data from API
      const wallet = localStorage.getItem("traxenWallet");
      if (!wallet) {
        showError("Wallet not connected.");
        return;
      }
      const token = localStorage.getItem("traxenAuthToken");

      if (!token) {
        throw new Error("Authentication token required.");
      }

      const response = await fetch(`/api/agreements/${agreementId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch agreement");
      }
      const agreement = await response.json();
      currentAgreement = agreement;

      // 3. Populate UI
      // ═══ YON — FIX ═══
      // `agreement-title.innerHTML` (below) replaces the whole <h2>, which
      // removes the `#agreement-id` span from the DOM. On the second render
      // (e.g. after funding), the old code crashed with
      // "Cannot set properties of null (setting 'textContent')".
      const agreementIdEl = document.getElementById("agreement-id");
      if (agreementIdEl) {
        agreementIdEl.textContent = agreement.onchain_id || agreementId;
      }
      // ═══ YON End ═══
      document.getElementById("agreement-title").innerHTML =
        `Agreement #${agreement.onchain_id || agreementId} ` +
        `<span class="pill ${getStatusClass(agreement.status)}" id="agreement-status-badge">` +
        `<span class="dot"></span>${agreement.status || "PendingAcceptance"}</span>`;

      const subText =
        agreement.agreement_name ||
        `${agreement.cargo_type || "Logistics"} · Carrier: ${agreement.carrier?.display_name || agreement.carrier_wallet || "Unknown"}`;
      document.getElementById("agreement-sub").textContent = subText;

      const status = agreement.status || "PendingAcceptance";
      const escrowAmount = agreement.escrow_amount
        ? parseFloat(
            ethers.formatEther(String(agreement.escrow_amount)),
          ).toFixed(4)
        : "0.00";
      document.getElementById("escrow-amount").textContent =
        `${escrowAmount} ETH`;
      document.getElementById("escrow-status").textContent =
        status === "Active" || status === "AwaitingFunding" ? "Locked" : status;

      document.getElementById("carrier-name").textContent =
        agreement.carrier?.display_name || agreement.carrier_wallet || "—";
      document.getElementById("deadline-date").textContent = agreement.deadline
        ? new Date(agreement.deadline).toLocaleString()
        : "—";
      document.getElementById("created-date").textContent = agreement.created_at
        ? new Date(agreement.created_at).toLocaleString()
        : "—";
      document.getElementById("contract-address").textContent =
        agreement.contract_address || window.__CONFIG?.contractAddress || "—";

      // 4. Render milestones
      const milestones = [...(agreement.milestones || [])].sort(
        (a, b) => Number(a.milestone_index) - Number(b.milestone_index),
      );

      agreement.milestones = milestones;
      currentAgreement.milestones = milestones;

      renderMilestones(milestones, escrowAmount);

      // 5. Enable/disable fund button
      const fundBtn = document.getElementById("fund-escrow-btn");

      if (fundBtn) {
        if (status === "AwaitingFunding") {
          fundBtn.disabled = false;
          fundBtn.textContent = "Fund Escrow";
        } else if (status === "PendingAcceptance") {
          fundBtn.disabled = true;
          fundBtn.textContent = "Awaiting Carrier Acceptance";
        } else if (status === "Active") {
          fundBtn.disabled = true;
          fundBtn.textContent = "Escrow Funded";
        } else {
          fundBtn.disabled = true;
          fundBtn.textContent = "Not Fundable";
        }
      }
    } catch (error) {
      console.error("Agreement details error:", error);
      showError(error.message);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────
  function getStatusClass(status) {
    const map = {
      PendingAcceptance: "amber",
      AwaitingFunding: "amber",
      Active: "lime",
      Completed: "gray",
      Rejected: "red",
      Cancelled: "red",
      Refunded: "red",
      Expired: "red",
    };
    return map[status] || "gray";
  }

  function showError(msg) {
    document.querySelector(".content").innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--red);">
          <h3>❌ ${msg}</h3>
          <button class="btn btn-ghost" onclick="window.loadPage('agreements')">← Back to Agreements</button>
        </div>
      `;
  }

  function renderMilestones(milestones, totalEth) {
    const track = document.getElementById("milestone-track");
    const list = document.getElementById("milestone-list");

    if (!milestones || milestones.length === 0) {
      track.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--text-faint);">No milestones defined.</div>';
      list.innerHTML =
        '<div style="padding:12px;color:var(--text-faint);">No milestones defined.</div>';
      return;
    }

    // ── Progress Track ──
    let trackHtml = "";
    milestones.forEach((m, i) => {
      const status = m.status || "Pending";
      let cls = "tnode";
      if (status === "Paid" || status === "Verified") cls += " complete";
      else if (status === "Submitted") cls += " current";
      const dotContent =
        status === "Paid" || status === "Verified" ? "✓" : i + 1;
      trackHtml += `
          <div class="${cls}">
            <div class="tdot">${dotContent}</div>
            <div class="tname">${m.description || `Milestone ${i + 1}`}</div>
            <div class="tamt">${m.payment_percentage || 0}%</div>
          </div>
        `;
    });
    const paidCount = milestones.filter((m) => m.status === "Paid").length;
    const progress = (paidCount / milestones.length) * 100;
    track.innerHTML = `
        <div class="track">
          <div class="track-fill" style="width:${progress}%"></div>
          ${trackHtml}
        </div>
      `;

    // ── Milestone List ──
    let listHtml = "";

    milestones.forEach((m, i) => {
      const amt =
        totalEth && m.payment_percentage
          ? ((totalEth * m.payment_percentage) / 100).toFixed(4)
          : "—";

      const status = m.status || "Pending";

      let rowClass = "milestone-pending";
      let icon = "•";
      let statusText = "Pending";
      let subText = "Not yet reached";

      if (status === "Paid") {
        rowClass = "milestone-paid";
        icon = "✓";
        statusText = "Paid";
        subText = "Received";
      } else if (status === "Submitted") {
        rowClass = "milestone-submitted";
        icon = "!";
        statusText = "Submitted";
        subText = "Proof submitted";
      } else if (status === "Verified") {
        rowClass = "milestone-verified";
        icon = "✓";
        statusText = "Verified";
        subText = "Verified — release payment";
      }

      let actionHtml = "";

      // ═══ YON : merged from Jed's variant — verify & release
      // are combined into a single action. ═══
      if (status === "Submitted") {
        actionHtml = `
    ${
      m.proof_url
        ? `<button class="btn btn-ghost btn-sm milestone-action-btn"
        onclick="window.open('${m.proof_url}', '_blank')">View Proof</button>`
        : ""
    }

    <button
      class="btn btn-primary btn-sm milestone-action-btn"
      onclick="verifyMilestoneAction(${i})"
      ${milestoneActionInProgress ? "disabled" : ""}
    >
      Verify &amp; Release Payment
    </button>
  `;
      } else if (status === "Verified") {
        // Brief transient state during auto-release — nothing to click
        actionHtml = `
    <span style="color:var(--amber);font-weight:600;">
      ⏳ Releasing payment…
    </span>
  `;
      }
      // ═══ YON End ═══

      listHtml += `
    <div class="milestone-row ${rowClass}">

      <div class="milestone-left">

        <div class="milestone-icon">
          ${icon}
        </div>

        <div class="milestone-info">

          <div class="name">
            ${m.description || `Milestone ${i + 1}`}
          </div>

          <div class="sub">
            ${subText}
          </div>

        </div>

      </div>

      <div class="right">

        <div class="amt">
          ${amt} ETH
        </div>

        <div class="percentage">
          ${m.payment_percentage || 0}% of escrow
        </div>

        <div class="status-label">
          ${statusText}
        </div>

        ${actionHtml}

      </div>

    </div>
  `;
    });

    list.innerHTML = listHtml;
  }

  // ─── Milestone actions ────────────────────────────────────
  // ═══ YON : merged from Jed's variant ═══
  // Verify + auto-release in a single flow, with a duplicate guard and a
  // single guaranteed reload point.
  window.verifyMilestoneAction = async function (milestoneIndex) {
    if (milestoneActionInProgress) return;

    let actionAttempted = false;

    try {
      if (!currentAgreement?.onchain_id) throw new Error("No agreement ID");

      const sessionOk = await window.Auth?.ensureFullSession?.();
      if (!sessionOk) return;

      if (typeof window.verifyMilestone !== "function") {
        throw new Error("verifyMilestone function not available");
      }

      milestoneActionInProgress = true;
      renderMilestones(currentAgreement.milestones || [],
        currentAgreement.escrow_amount
          ? parseFloat(ethers.formatEther(String(currentAgreement.escrow_amount))).toFixed(4)
          : "0.00"
      );

      showToast("Verifying milestone...", "info");
      const result = await window.verifyMilestone(
        currentAgreement.onchain_id,
        milestoneIndex,
      );

      console.log("🔥 VERIFY RESULT:", result);
      console.log("🔥 VERIFY FUNCTION:", window.verifyMilestone.toString());

      // Sync the verified status to Supabase
      const wallet = localStorage.getItem("traxenWallet");

      const syncResponse = await fetch("/api/milestones/verify", {
        method: "POST",
        ///Fix - auth incpmplete migration
        headers: window.getAuthHeaders(),
        ///Fix end
        body: JSON.stringify({
          agreementId: currentAgreement.onchain_id,
          milestoneId: milestoneIndex,
          txHash: result?.hash || result?.transactionHash || null,
        }),
      });

      if (!syncResponse.ok) {
        const errorData = await syncResponse.json();
        throw new Error(errorData.error || "Failed to sync milestone status");
      }

      console.log("✅ Milestone status synced to database");

      // Update the current milestone locally.
      // The backend has already been synced successfully.
      const verifiedMilestone = (currentAgreement.milestones || []).find(
        (m) => Number(m.milestone_index) === Number(milestoneIndex)
      );

      if (verifiedMilestone) {
        verifiedMilestone.status = "Verified";
      }

      // Re-render only the milestone section.
      // This will immediately show the "Release Payment" button.
      renderMilestones(
        currentAgreement.milestones || [],
        currentAgreement.escrow_amount
          ? parseFloat(
            ethers.formatEther(String(currentAgreement.escrow_amount))
          ).toFixed(4)
          : "0.00"
      );

      showToast(
        "Milestone verified. You can now release the payment.",
        "success"
      );

    } catch (error) {
      console.error("Verify milestone error:", error);
      showToast(error.message || "Failed to verify milestone", "error");
    } finally {
      milestoneActionInProgress = false;
    }
  };

  window.releaseMilestonePayment = async function (milestoneIndex) {
    if (milestoneActionInProgress) return;

    try {
      if (!currentAgreement?.onchain_id) {
        throw new Error("No agreement ID");
      }

      const sessionOk = await window.Auth?.ensureFullSession?.();
      if (!sessionOk) return;

      if (typeof window.releasePayment !== "function") {
        throw new Error("releasePayment function not available");
      }

      const milestone = (currentAgreement.milestones || []).find(
        (m) => Number(m.milestone_index) === Number(milestoneIndex),
      );

      if (!milestone || milestone.status !== "Submitted") {
        throw new Error("Milestone must be in Submitted state to verify");
      }

      const amountEth =
        currentAgreement.escrow_amount && milestone.payment_percentage
          ? (
              (parseFloat(
                ethers.formatEther(String(currentAgreement.escrow_amount)),
              ) *
                Number(milestone.payment_percentage)) /
              100
            ).toFixed(4)
          : "the milestone amount";

      if (
        !confirm(
          `Verify this milestone AND release ${amountEth} ETH to the carrier?\n\n` +
            `This will trigger two MetaMask confirmations (verify, then release).`,
        )
      )
        return;

      milestoneActionInProgress = true;

      // Disable buttons during the operation
      renderMilestones(
        currentAgreement.milestones || [],
        currentAgreement.escrow_amount
          ? parseFloat(
              ethers.formatEther(String(currentAgreement.escrow_amount)),
            ).toFixed(4)
          : "0.00",
      );

      const wallet = localStorage.getItem("traxenWallet");

      // ═══ YON — HISTORY/REPUTATION SYNC ═══
      // Record the payment release (payment_history) and, when this release
      // completes the agreement, the REP reward (reputation_history).
      try {
        const paymentSyncResponse = await fetch("/api/payment/release", {
          method: "POST",
          ///Fix - auth incpmplete migration
          headers: window.getAuthHeaders(),
          ///Fix end
          body: JSON.stringify({
            agreementId: currentAgreement.onchain_id,
            milestoneId: milestoneIndex,
            txHash: result?.hash || result?.transactionHash || null,
          }),
        });
        if (!paymentSyncResponse.ok) {
          console.warn(
            "[Yon] payment/release DB sync failed:",
            paymentSyncResponse.status,
          );
        }
      } catch (paymentSyncError) {
        console.warn("[Yon] payment/release sync skipped:", paymentSyncError);
      }
      // ═══ YON End ═══

      // ─── Step 1/2: VERIFY ─────────────────────────────
      showToast("Step 1/2: Verifying milestone…", "info");
      let verifyResult;
      try {
        verifyResult = await window.verifyMilestone(
          currentAgreement.onchain_id,
          milestoneIndex,
        );
        console.log("✅ Verify result:", verifyResult);

        const verifySync = await fetch("/api/milestones/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            agreementId: currentAgreement.onchain_id,
            milestoneId: milestoneIndex,
            txHash: verifyResult?.hash || verifyResult?.transactionHash || null,
          }),
        });

        if (!verifySync.ok) {
          const err = await verifySync.json();
          throw new Error(err.error || "Verify sync failed");
        }
      } catch (e) {
        console.error("Verify failed:", e);
        showToast("❌ Verify failed: " + (e.reason || e.message), "error");
        milestoneActionInProgress = false;
        await window.initAgreementDetails();
        return;
      }

      // ─── Step 2/2: AUTO-RELEASE ───────────────────────
      showToast("Step 2/2: Releasing payment…", "info");
      let releaseResult;
      try {
        releaseResult = await window.releasePayment(
          currentAgreement.onchain_id,
          milestoneIndex,
        );
        console.log("✅ Release result:", releaseResult);

        const releaseSync = await fetch(
          `/api/agreements/${currentAgreement.onchain_id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!releaseSync.ok) {
          const err = await releaseSync.json();
          throw new Error(err.error || "Release sync failed");
        }

        currentAgreement = await releaseSync.json();
      } catch (e) {
        // ─── DUPLICATE GUARD ──────────────────────────
        const msg = (e.reason || e.message || "").toLowerCase();
        if (msg.includes("already paid") || msg.includes("already released")) {
          showToast(
            "⚠️ Milestone was already paid (auto-release skipped).",
            "warning",
          );
          await window.initAgreementDetails();
          return;
        }
        console.error("Release failed:", e);
        showToast(
          "⚠️ Verified, but release failed: " + (e.reason || e.message),
          "warning",
        );
        await window.initAgreementDetails();
        return;
      } finally {
        milestoneActionInProgress = false;
      }

      showToast(
        `✅ Milestone verified & ${amountEth} ETH released!`,
        "success",
      );
      await window.initAgreementDetails();
    } catch (error) {
      console.error("Verify & release error:", error);
      showToast(error.message || "Failed to verify milestone", "error");
      milestoneActionInProgress = false;
    }
  };

  // ─── Existing actions ────────────────────────────────────
  window.fundEscrow = function () {
    alert("Fund escrow functionality will be implemented in the next step.");
  };
  window.raiseDispute = function () {
    alert("Dispute functionality will be implemented in the next step.");
  };

  // Auto‑init fallback (if loaded directly, not via SPA)
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    if (window.initAgreementDetails) window.initAgreementDetails();
  }
})();
