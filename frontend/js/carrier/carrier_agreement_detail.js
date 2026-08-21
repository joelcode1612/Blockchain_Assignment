// ─── CARRIER AGREEMENT DETAILS ────────────────────────────
// This file is loaded when the router navigates to "agreement_details"
// for a carrier.

(function () {
  // ─── State ──────────────────────────────────────────────
  let currentAgreement = null;
  let currentMilestones = [];
  let contract = null;

  // ─── Init function called by the SPA router ──────────────
  window.initAgreementDetails = async function () {
    try {
      // 1. Check session
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      // 2. Get agreement ID from URL
      const params = new URLSearchParams(window.location.search);
      const agreementId = params.get("id");
      if (!agreementId) {
        showError("No agreement ID provided.");
        return;
      }

      // 3. Get contract instance
      if (typeof window.getContract === "function") {
        contract = window.getContract();
      } else {
        throw new Error("Web3 contract not available.");
      }

      // 4. Fetch agreement data (from API)
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
      currentMilestones = agreement.milestones || [];

      // 5. Populate UI
      populateUI(agreement);

      // 6. Enable/disable action buttons based on status
      setupActions(agreement);
    } catch (error) {
      console.error("Agreement details error:", error);
      showError(error.message);
    }
  };

  // ─── Populate UI ──────────────────────────────────────────
  function populateUI(agreement) {
    // Agreement ID
    const idEl = document.getElementById("agreement-id");
    if (idEl) idEl.textContent = agreement.onchain_id || "—";

    // Status badge
    const statusBadge = document.getElementById("agreement-status-badge");
    if (statusBadge) {
      const status = agreement.status || "PendingAcceptance";
      const statusClass = getStatusClass(status);
      statusBadge.className = `pill ${statusClass}`;
      statusBadge.innerHTML = `<span class="dot"></span>${status}`;
    }

    // Title & sub
    const titleEl = document.querySelector(".detail-header h2");
    if (titleEl) {
      const id = agreement.onchain_id || "—";
      titleEl.innerHTML = `Agreement #${id} <span class="pill ${getStatusClass(agreement.status)}" style="margin-left:8px"><span class="dot"></span>${agreement.status || "PendingAcceptance"}</span>`;
    }

    const subEl = document.querySelector(".detail-header .sub");
    if (subEl) {
      const shipperName =
        agreement.shipper?.display_name ||
        agreement.shipper_wallet ||
        "Unknown";
      const cargo = agreement.cargo_type || "Logistics";
      subEl.textContent = `${cargo} · Shipper: ${shipperName}`;
    }

    // Escrow amount
    const escrowAmt = document.querySelector(".escrow-box .amt");
    if (escrowAmt) {
      const amount = agreement.escrow_amount
        ? parseFloat(ethers.formatEther(agreement.escrow_amount)).toFixed(4)
        : "0.00";
      escrowAmt.textContent = `${amount} ETH`;
    }

    // Job Info card
    const shipperEl = document.querySelector(".kv .v");
    if (shipperEl) {
      // Find the row that says "Shipper"
      const kvItems = document.querySelectorAll(".kv");
      kvItems.forEach((item) => {
        const label = item.querySelector(".k");
        if (label && label.textContent === "Shipper") {
          const value = item.querySelector(".v");
          if (value)
            value.textContent =
              agreement.shipper?.display_name ||
              agreement.shipper_wallet ||
              "—";
        }
        if (label && label.textContent === "Deadline") {
          const value = item.querySelector(".v");
          if (value && agreement.deadline) {
            value.textContent = new Date(agreement.deadline).toLocaleString();
          }
        }
        if (label && label.textContent === "Accepted") {
          const value = item.querySelector(".v");
          // If carrier_accepted_at is available, use it; otherwise fallback to created_at
          if (value)
            value.textContent = agreement.carrier_accepted_at
              ? new Date(agreement.carrier_accepted_at).toLocaleString()
              : "—";
        }
        if (label && label.textContent === "Contract") {
          const value = item.querySelector(".v");
          if (value)
            value.textContent = agreement.contract_address || "0x7a83…4F2E";
        }
      });
    }

    // Milestone progress track
    renderMilestoneTrack(currentMilestones);

    // Milestone list
    renderMilestoneList(currentMilestones, agreement.escrow_amount);

    // Enable/disable submit proof based on status
    // We'll handle in setupActions
  }

  // ─── Render milestone progress track ──────────────────────
  function renderMilestoneTrack(milestones) {
    const trackContainer = document.querySelector(".track");
    if (!trackContainer) return;

    if (!milestones || milestones.length === 0) {
      trackContainer.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--text-faint);">No milestones defined.</div>';
      return;
    }

    // Calculate progress
    const paidCount = milestones.filter((m) => m.status === "Paid").length;
    const progress = (paidCount / milestones.length) * 100;

    let html = `<div class="track-fill" style="width:${progress}%"></div>`;
    milestones.forEach((m, i) => {
      const status = m.status || "Pending";
      let cls = "tnode";
      if (status === "Paid" || status === "Verified") cls += " complete";
      else if (status === "Submitted") cls += " current";
      const dotContent =
        status === "Paid" || status === "Verified" ? "✓" : i + 1;
      const pct = m.payment_percentage || 0;
      html += `
        <div class="${cls}">
          <div class="tdot">${dotContent}</div>
          <div class="tname">${m.description || `Milestone ${i + 1}`}</div>
          <div class="tamt">${pct}%</div>
        </div>
      `;
    });
    trackContainer.innerHTML = html;
  }

  // ─── Render milestone list with payouts ──────────────────
  function renderMilestoneList(milestones, totalWei) {
    const container = document.querySelector(
      ".info-card:last-child .milestone-row",
    )?.parentElement;
    if (!container) return;

    if (!milestones || milestones.length === 0) {
      container.innerHTML =
        '<div style="padding:12px;color:var(--text-faint);">No milestones defined.</div>';
      return;
    }

    const totalEth = totalWei ? parseFloat(ethers.formatEther(totalWei)) : 0;

    let html = "";
    milestones.forEach((m, i) => {
      const pct = m.payment_percentage || 0;
      const amt = ((totalEth * pct) / 100).toFixed(4);
      const status = m.status || "Pending";
      let statusColor = "var(--text-faint)";
      let statusText = status;
      if (status === "Paid") {
        statusColor = "var(--lime)";
        statusText = "Received";
      } else if (status === "Verified") {
        statusColor = "var(--blue)";
        statusText = "Verified – release payment";
      } else if (status === "Submitted") {
        statusColor = "var(--amber)";
        statusText = "Proof submitted";
      } else {
        statusText = "Locked";
      }
      html += `
        <div class="milestone-row">
          <div>
            <div class="name">${i + 1}. ${m.description || `Milestone ${i + 1}`}</div>
            <div class="sub">${statusText}</div>
          </div>
          <div class="right">
            <div class="amt">${amt} ETH</div>
            <div class="sub" style="color:${statusColor}">${status}</div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // ─── Setup action buttons (submit proof, accept, reject) ──
  function setupActions(agreement) {
    const status = agreement.status || "PendingAcceptance";
    const submitBtn = document.querySelector(
      '.btn-primary[onclick*="submitProof"]',
    );
    const uploadBox = document.querySelector(".upload-box");
    const proofSection = document.querySelector(".info-card:has(.upload-box)");

    if (!proofSection) return;

    // Hide proof section if not applicable (e.g., completed or pending acceptance)
    if (
      status === "Completed" ||
      status === "Rejected" ||
      status === "Cancelled" ||
      status === "Refunded" ||
      status === "Expired"
    ) {
      if (proofSection) proofSection.style.display = "none";
      return;
    }

    // For pending acceptance, show accept/reject buttons instead of proof
    if (status === "PendingAcceptance") {
      // Remove proof section and show accept/reject
      if (proofSection) {
        proofSection.innerHTML = `
          <h3>Job Offer — Pending Your Acceptance</h3>
          <div class="btn-row" style="margin-top:12px;">
            <button class="btn btn-primary" onclick="acceptAgreement()">Accept Job</button>
            <button class="btn btn-danger" onclick="rejectAgreement()">Decline Job</button>
          </div>
        `;
      }
      return;
    }

    // For active/awaiting funding, enable proof submission
    if (status === "Active" || status === "AwaitingFunding") {
      // Find the next pending milestone that the carrier can submit
      const nextMilestone = currentMilestones.find(
        (m) => m.status === "Pending",
      );
      if (nextMilestone) {
        const milestoneIndex =
          nextMilestone.milestone_index !== undefined
            ? nextMilestone.milestone_index
            : currentMilestones.indexOf(nextMilestone);
        const label = document.querySelector(".info-card:has(.upload-box) h3");
        if (label) {
          label.textContent = `Submit Proof — ${nextMilestone.description || `Milestone ${milestoneIndex + 1}`}`;
        }
        // Update button onclick to call submitMilestone with correct index
        const btn = proofSection.querySelector(".btn-primary");
        if (btn) {
          btn.onclick = function () {
            submitMilestoneProof(milestoneIndex);
          };
        }
        // Enable upload box if needed
        const upload = proofSection.querySelector(".upload-box");
        if (upload) {
          upload.onclick = function () {
            // You can implement file upload logic here
            alert("📎 Upload proof (photo, GPS checkpoint, or signed receipt)");
          };
        }
      } else {
        // All milestones are either submitted or paid/verified – no pending
        if (proofSection) {
          const allPaid = currentMilestones.every((m) => m.status === "Paid");
          if (allPaid) {
            proofSection.innerHTML = `<h3>All milestones completed and paid</h3>`;
          } else {
            proofSection.innerHTML = `<h3>Awaiting shipper verification for submitted milestones</h3>`;
          }
        }
      }
    }
  }

  // ─── Submit milestone proof (calls smart contract) ──────
  window.submitMilestoneProof = async function (milestoneIndex) {
    try {
      const agreementId = currentAgreement.onchain_id;
      if (!agreementId) throw new Error("No agreement ID");

      // Check wallet connection
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      // Call contract method
      if (typeof window.submitMilestone !== "function") {
        throw new Error("submitMilestone function not available");
      }

      showToast("Submitting proof...", "info");
      const result = await window.submitMilestone(agreementId, milestoneIndex);
      console.log("Proof submitted:", result);

      showToast("✅ Proof submitted successfully!", "success");

      // Refresh the page data
      await window.initAgreementDetails();
    } catch (error) {
      console.error("Submit proof error:", error);
      showToast(error.message || "Failed to submit proof", "error");
    }
  };

  // ─── Accept agreement ─────────────────────────────────────
  window.acceptAgreement = async function () {
    try {
      const agreementId = currentAgreement.onchain_id;
      if (!agreementId) throw new Error("No agreement ID");

      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      if (typeof window.acceptAgreement !== "function") {
        throw new Error("acceptAgreement function not available");
      }

      showToast("Accepting agreement...", "info");
      const result = await window.acceptAgreement(agreementId);
      console.log("Accept result:", result);

      showToast("✅ Agreement accepted! Awaiting shipper funding.", "success");
      await window.initAgreementDetails();
    } catch (error) {
      console.error("Accept error:", error);
      showToast(error.message || "Failed to accept", "error");
    }
  };

  // ─── Reject agreement ─────────────────────────────────────
  window.rejectAgreement = async function () {
    try {
      const agreementId = currentAgreement.onchain_id;
      if (!agreementId) throw new Error("No agreement ID");

      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      if (typeof window.rejectAgreement !== "function") {
        throw new Error("rejectAgreement function not available");
      }

      if (!confirm("Are you sure you want to reject this agreement?")) return;

      showToast("Rejecting agreement...", "info");
      const result = await window.rejectAgreement(agreementId);
      console.log("Reject result:", result);

      showToast("Agreement rejected.", "warning");
      await window.initAgreementDetails();
    } catch (error) {
      console.error("Reject error:", error);
      showToast(error.message || "Failed to reject", "error");
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
    const content = document.querySelector(".content");
    if (content) {
      content.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--red);">
          <h3>❌ ${msg}</h3>
          <button class="btn btn-ghost" onclick="window.loadPage('dashboard')">← Back to Dashboard</button>
        </div>
      `;
    }
  }

  function showToast(message, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }

  // ─── Auto‑init if the page is loaded directly ──────────
  if (document.querySelector(".detail-header")) {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      if (typeof window.initAgreementDetails === "function") {
        window.initAgreementDetails();
      }
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        if (typeof window.initAgreementDetails === "function") {
          window.initAgreementDetails();
        }
      });
    }
  }
})();
