(function () {
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

      // 3. Populate UI
      document.getElementById("agreement-id").textContent =
        agreement.onchain_id || agreementId;
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
        ? parseFloat(ethers.formatEther(agreement.escrow_amount)).toFixed(4)
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
        agreement.contract_address || "0x7a83…4F2E"; // placeholder

      // 4. Render milestones
      const milestones = agreement.milestones || [];
      renderMilestones(milestones, escrowAmount);

      // 5. Enable/disable fund button
      const fundBtn = document.getElementById("fund-escrow-btn");
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
      let statusColor = "var(--text-faint)";
      if (status === "Paid") statusColor = "var(--lime)";
      else if (status === "Verified") statusColor = "var(--blue)";
      else if (status === "Submitted") statusColor = "var(--amber)";
      listHtml += `
          <div class="milestone-row">
            <div>
              <div class="name">${i + 1}. ${m.description || `Milestone ${i + 1}`}</div>
              <div class="sub">${status === "Pending" ? "Not yet reached" : status === "Submitted" ? "Awaiting verification" : status === "Verified" ? "Verified – release payment" : "Paid"}</div>
            </div>
            <div class="right">
              <div class="amt">${amt} ETH</div>
              <div class="sub" style="color:${statusColor}">${status}</div>
            </div>
          </div>
        `;
    });
    list.innerHTML = listHtml;
  }

  // ─── Actions ──────────────────────────────────────────────
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
