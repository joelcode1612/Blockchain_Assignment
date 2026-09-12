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
      const response = await fetch(`/api/agreements/${agreementId}`, {
        headers: { "x-wallet-address": wallet },
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
          ethers.formatEther(String(agreement.escrow_amount))
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
        (a, b) => Number(a.milestone_index) - Number(b.milestone_index)
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
        // ═══ YON - merged from Jed's variant ═══
        subText = "Verified — releasing payment…";
        // ═══ YON End ═══
      }

      let actionHtml = "";

      // ═══ YON : merged from Jed's variant — verify & release
      // are combined into a single action. ═══
      if (status === "Submitted") {
        actionHtml = `
    ${m.proof_url
            ? `
          <button
            class="btn btn-ghost btn-sm milestone-action-btn"
            onclick="window.open('${m.proof_url}', '_blank')"
          >
            View Proof
          </button>
        `
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
      if (!currentAgreement?.onchain_id) {
        throw new Error("No agreement ID");
      }

      const sessionOk = await window.Auth?.ensureFullSession?.();
      if (!sessionOk) return;

      if (typeof window.verifyMilestone !== "function") {
        throw new Error("verifyMilestone function not available");
      }
      if (typeof window.releasePayment !== "function") {
        throw new Error("releasePayment function not available");
      }

      const milestone = (currentAgreement.milestones || []).find(
        (m) => Number(m.milestone_index) === Number(milestoneIndex)
      );

      if (!milestone || milestone.status !== "Submitted") {
        throw new Error("Milestone must be in Submitted state to verify");
      }

      const amountEth =
        currentAgreement.escrow_amount && milestone.payment_percentage
          ? (
            (parseFloat(ethers.formatEther(String(currentAgreement.escrow_amount))) *
              Number(milestone.payment_percentage)) /
            100
          ).toFixed(4)
          : "the milestone amount";

      if (
        !confirm(
          `Verify this milestone AND release ${amountEth} ETH to the carrier?\n\n` +
          `This will trigger two MetaMask confirmations (verify, then release).`
        )
      )
        return;

      // From here on, action WILL be attempted → reload guaranteed
      actionAttempted = true;
      milestoneActionInProgress = true;

      // Disable buttons during the operation
      renderMilestones(
        currentAgreement.milestones || [],
        currentAgreement.escrow_amount
          ? parseFloat(
            ethers.formatEther(String(currentAgreement.escrow_amount))
          ).toFixed(4)
          : "0.00"
      );

      const wallet = localStorage.getItem("traxenWallet");

      // ─── Step 1/2: VERIFY ──────────────────────────────
      showToast("Step 1/2: Verifying milestone…", "info");
      try {
        const verifyResult = await window.verifyMilestone(
          currentAgreement.onchain_id,
          milestoneIndex
        );
        console.log("✅ Verify result:", verifyResult);

        const verifyTxHash =
          verifyResult?.hash || verifyResult?.transactionHash || null;

        const verifySync = await fetch("/api/milestones/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": wallet,
          },
          body: JSON.stringify({
            agreementId: currentAgreement.onchain_id,
            milestoneId: milestoneIndex,
            txHash: verifyTxHash,
          }),
        });

        if (!verifySync.ok) {
          const err = await verifySync.json().catch(() => ({}));
          throw new Error(err.error || "Verify sync failed");
        }
        console.log("✅ Milestone status synced to database");
      } catch (e) {
        console.error("Verify failed:", e);
        showToast("❌ Verify failed: " + (e.reason || e.message), "error");
        return; // finally will reload
      }

      // ─── Step 2/2: AUTO-RELEASE ────────────────────────
      showToast("Step 2/2: Releasing payment…", "info");
      try {
        const releaseResult = await window.releasePayment(
          currentAgreement.onchain_id,
          milestoneIndex
        );
        console.log("✅ Release result:", releaseResult);

        const txHash =
          releaseResult?.hash || releaseResult?.transactionHash || null;

        // ═══ YON — HISTORY/REPUTATION SYNC ═══
        // Writes payment_history row, marks milestone Paid, marks
        // agreement Completed if it was the last milestone, and
        // awards the REP reward automatically via the backend.
        if (txHash) {
          try {
            const payRes = await fetch("/api/payment/release", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-wallet-address": wallet,
              },
              body: JSON.stringify({
                agreementId: currentAgreement.onchain_id,
                milestoneId: milestoneIndex,
                txHash: txHash,
              }),
            });

            if (!payRes.ok) {
              const errBody = await payRes.json().catch(() => ({}));
              console.warn(
                "⚠️ payment_history sync failed:",
                errBody.error || payRes.status
              );
            } else {
              console.log("✅ payment_history recorded");
            }
          } catch (syncErr) {
            console.warn("payment_history POST failed (non-critical):", syncErr);
          }
        }
        // ═══ YON End ═══

        // Refresh agreement from DB
        const releaseSync = await fetch(
          `/api/agreements/${currentAgreement.onchain_id}`,
          { headers: { "x-wallet-address": wallet } }
        );

        if (!releaseSync.ok) {
          const err = await releaseSync.json().catch(() => ({}));
          throw new Error(err.error || "Release sync failed");
        }

        currentAgreement = await releaseSync.json();
      } catch (e) {
        // Duplicate guard: an already-paid milestone is not fatal
        const msg = (e.reason || e.message || "").toLowerCase();
        if (msg.includes("already paid") || msg.includes("already released")) {
          showToast(
            "⚠️ Milestone was already paid (auto-release skipped).",
            "warning"
          );
          return; // finally will reload
        }
        console.error("Release failed:", e);
        showToast(
          "⚠️ Verified, but release failed: " + (e.reason || e.message),
          "warning"
        );
        return; // finally will reload
      }

      // ─── Success ───────────────────────────────────────
      showToast(`✅ Milestone verified & ${amountEth} ETH released!`, "success");
    } catch (error) {
      console.error("Verify & release error:", error);
      showToast(error.message || "Failed to verify milestone", "error");
    } finally {
      milestoneActionInProgress = false;

      // ═══ YON — single guaranteed reload point ═══
      if (actionAttempted) {
        try {
          await window.initAgreementDetails();
        } catch (reloadErr) {
          console.error("Reload after verify action failed:", reloadErr);
        }
      }
      // ═══ YON End ═══
    }
  };

  // ═══ YON : verify + release were merged into
  // verifyMilestoneAction (Jed's cherry-pick). This legacy function is no
  // longer bound to any UI button; kept for compatibility. ═══
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

      if (!milestone || milestone.status !== "Verified") {
        throw new Error("Milestone must be verified before payment can be released");
      }

      const amountEth = currentAgreement.escrow_amount && milestone.payment_percentage
        ? (parseFloat(ethers.formatEther(String(currentAgreement.escrow_amount))) * Number(milestone.payment_percentage) / 100).toFixed(4)
        : "the milestone amount";

      if (!confirm(`Release ${amountEth} ETH to the carrier?`)) return;

      const result = await window.releasePayment(
        currentAgreement.onchain_id,
        milestoneIndex
      );

      console.log("Payment release result:", result);

      // Sync released amount and milestone status to Supabase
      const wallet = localStorage.getItem("traxenWallet");

      // ═══ YON — HISTORY/REPUTATION SYNC ═══
      // Record the payment release (payment_history) and, when this release
      // completes the agreement, the REP reward (reputation_history).
      try {
        const paymentSyncResponse = await fetch("/api/payment/release", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": wallet,
          },
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

      const syncResponse = await fetch(
        `/api/agreements/${currentAgreement.onchain_id}`,
        {
          headers: {
            "x-wallet-address": wallet,
          },
        }
      );

      if (!syncResponse.ok) {
        const errorData = await syncResponse.json();
        throw new Error(
          errorData.error ||
          "Payment released, but database sync failed"
        );
      }

      const syncedAgreement = await syncResponse.json();

      currentAgreement = syncedAgreement;

      console.log(
        "✅ Payment and released amount synced to database"
      );

      if (milestone) {
        milestone.status = "Paid";
      }

      console.log("Payment release result:", result);

      if (milestone) {
        milestone.status = "Paid";
      }

      renderMilestones(
        currentAgreement.milestones || [],
        currentAgreement.escrow_amount
          ? parseFloat(
            ethers.formatEther(String(currentAgreement.escrow_amount))
          ).toFixed(4)
          : "0.00"
      );

      showToast("Payment released successfully.", "success");

    } catch (error) {
      console.error("Release payment error:", error);
      showToast(error.message || "Failed to release payment", "error");
    } finally {
      milestoneActionInProgress = false;
    }
  };

  // ─── Existing actions ────────────────────────────────────
  // ─── Fund Escrow (with full sync + cache invalidation) ───
  let fundEscrowInProgress = false;

  window.fundEscrow = async function () {
    if (fundEscrowInProgress) return;

    try {
      if (!currentAgreement?.onchain_id) {
        throw new Error("No agreement loaded.");
      }
      if (currentAgreement.status !== "AwaitingFunding") {
        throw new Error("Escrow can only be funded while awaiting funding.");
      }
      if (!window.contract) {
        throw new Error("Contract not available. Please connect your wallet.");
      }

      const sessionOk = await window.Auth?.ensureFullSession?.();
      if (!sessionOk) return;

      // Use the total escrow value automatically.
      const escrowWei = BigInt(String(currentAgreement.escrow_amount));
      const amountEth = ethers.formatEther(escrowWei);

      const wallet =
        window.userWalletAddress || localStorage.getItem("traxenWallet");
      if (!wallet) {
        throw new Error("Wallet not connected.");
      }

      // Make sure the wallet has enough funds before sending the tx.
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(wallet);
      if (balance < escrowWei) {
        throw new Error(
          `Insufficient balance. Escrow requires ${amountEth} ETH but the wallet only has ${ethers.formatEther(balance)} ETH.`
        );
      }

      const ok = await customConfirm.confirm(
        `Fund escrow with the full amount of <strong>${amountEth} ETH</strong>?`,
        "Confirm Escrow Deposit"
      );
      if (!ok) return;

      fundEscrowInProgress = true;
      const fundBtn = document.getElementById("fund-escrow-btn");
      if (fundBtn) {
        fundBtn.disabled = true;
        fundBtn.textContent = "Funding...";
      }

      showToast("Funding escrow...", "info");

      // ═════════════════════════════════════════════════════
      // STEP 1 — Send the on-chain transaction
      // ═════════════════════════════════════════════════════
      const tx = await window.contract.depositEscrow(
        currentAgreement.onchain_id,
        { value: escrowWei, from: wallet }
      );
      await tx.wait();
      console.log("✅ On-chain deposit confirmed:", tx.hash);

      // ═════════════════════════════════════════════════════
      // STEP 2 — Sync to backend (escrow_history + agreements.status)
      // ═════════════════════════════════════════════════════
      let syncOk = false;
      try {
        const syncResponse = await fetch(
          `/api/escrow/shipper/${currentAgreement.onchain_id}/deposit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-wallet-address": wallet,
            },
            body: JSON.stringify({
              amount: escrowWei.toString(),
              txHash: tx.hash,
            }),
          }
        );

        if (syncResponse.ok) {
          syncOk = true;
          const data = await syncResponse.json().catch(() => ({}));
          console.log("✅ Backend sync OK:", data);
        } else {
          const errText = await syncResponse.text().catch(() => "");
          console.warn(
            "⚠️ Escrow funded on-chain, but DB sync returned",
            syncResponse.status,
            errText
          );
        }
      } catch (syncError) {
        console.warn("⚠️ Backend sync request failed:", syncError);
      }

      if (syncOk) {
        showToast(`Escrow funded with ${amountEth} ETH!`, "success");
      } else {
        // On-chain succeeded but DB didn't record it — warn the user
        showToast(
          `Escrow funded on-chain, but DB sync failed. Please refresh.`,
          "warning"
        );
      }

      // ═════════════════════════════════════════════════════
      // STEP 3 — Invalidate caches so all pages see fresh data
      // ═════════════════════════════════════════════════════
      try {
        // Agreement list cache (used by dashboard, deposit page, milestone page)
        if (typeof window.invalidateAgreementsCache === "function") {
          window.invalidateAgreementsCache();
        } else {
          Object.keys(localStorage)
            .filter((k) => k.startsWith("agreements_"))
            .forEach((k) => localStorage.removeItem(k));
        }

        // History cache (used by the Transaction History page)
        if (typeof window.invalidateHistoryCache === "function") {
          window.invalidateHistoryCache();
        } else {
          Object.keys(localStorage)
            .filter((k) => k.startsWith("history_"))
            .forEach((k) => localStorage.removeItem(k));
        }

        console.log("🗑️ Caches invalidated after deposit");
      } catch (cacheErr) {
        console.warn("Cache invalidation failed (non-critical):", cacheErr);
      }

      // ═════════════════════════════════════════════════════
      // STEP 4 — Refresh the current agreement details
      // ═════════════════════════════════════════════════════
      if (typeof window.initAgreementDetails === "function") {
        await window.initAgreementDetails();
      }
    } catch (error) {
      console.error("Fund escrow error:", error);
      const msg = error?.reason || error?.message || "Failed to fund escrow";
      if (typeof customAlert !== "undefined") {
        customAlert.alert(msg, "Deposit Failed");
      } else {
        showToast(msg, "error");
      }
    } finally {
      fundEscrowInProgress = false;
      const fundBtn = document.getElementById("fund-escrow-btn");
      if (fundBtn && currentAgreement?.status !== "Active") {
        fundBtn.disabled = false;
        fundBtn.textContent = "Fund Escrow";
      }
    }
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
