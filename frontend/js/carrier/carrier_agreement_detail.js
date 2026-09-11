// ─── CARRIER AGREEMENT DETAILS ────────────────────────────
(function () {
  let currentAgreement = null;
  let currentMilestones = [];
  let contract = null;

  let selectedProofFile = null;
  let proofPreviewUrl = null;

  // ─── Init function called by the SPA router ──────────────
  window.initAgreementDetails = async function () {
    try {
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      const params = new URLSearchParams(window.location.search);
      const agreementId = params.get("id");
      if (!agreementId) {
        showError("No agreement ID provided.");
        return;
      }

      if (typeof window.getContract === "function") {
        contract = window.getContract();
      } else {
        throw new Error("Web3 contract not available.");
      }

      const wallet = localStorage.getItem("traxenWallet");
      if (!wallet) {
        showError("Wallet not connected.");
        return;
      }
      
      const token = localStorage.getItem("traxenAuthToken");
      // 1. Fetch from database
      const response = await fetch(`/api/agreements/${agreementId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch agreement");
      }
      const agreement = await response.json();
      currentAgreement = agreement;

      currentMilestones = [...(agreement.milestones || [])].sort(
        (a, b) => Number(a.milestone_index) - Number(b.milestone_index),
      );

      // 2. Fetch from blockchain for verification
      try {
        const onchainAgreement = await window.getAgreement(agreementId);
        console.log("On-chain agreement:", onchainAgreement);
        // Compare status, escrow amount, etc. and log discrepancies
        // You can display a warning if they differ
        if (onchainAgreement.status !== dbAgreement.status) {
          console.warn(
            `Status mismatch: DB=${dbAgreement.status}, On-chain=${onchainAgreement.status}`,
          );
        }
        // You could also update UI with on-chain data if DB is stale
        // For now we trust DB, but we could override status if needed.
      } catch (e) {
        console.warn("Could not fetch on-chain agreement:", e);
      }

      // 3. Populate UI
      populateUI(dbAgreement);

      // 4. Enable/disable action buttons
      setupActions(dbAgreement);
    } catch (error) {
      console.error("Agreement details error:", error);
      showError(error.message);
    }
  };

  function populateUI(agreement) {
    document.getElementById("agreement-id").textContent =
      agreement.onchain_id || "—";
    const statusBadge = document.getElementById("agreement-status-badge");
    if (statusBadge) {
      const status = agreement.status || "PendingAcceptance";
      statusBadge.className = `pill ${getStatusClass(status)}`;
      statusBadge.innerHTML = `<span class="dot"></span>${status}`;
    }

    const titleEl = document.querySelector(".detail-header h2");
    if (titleEl) {
      const id = agreement.onchain_id || "—";
      titleEl.innerHTML = `Agreement #${id} <span class="pill ${getStatusClass(agreement.status)}" style="margin-left:8px"><span class="dot"></span>${agreement.status || "PendingAcceptance"}</span>`;
    }

    const subEl = document.getElementById("agreement-sub");
    if (subEl) {
      const shipperName =
        agreement.shipper?.display_name ||
        agreement.shipper_wallet ||
        "Unknown";
      const cargo = agreement.cargo_type || "Logistics";
      subEl.textContent = `${cargo} · Shipper: ${shipperName}`;
    }

    const escrowAmt = document.querySelector(".escrow-box .amt");
    if (escrowAmt) {
      const amount = agreement.escrow_amount
        ? parseFloat(
            ethers.formatEther(BigInt(agreement.escrow_amount).toString()),
          ).toFixed(4)
        : "0.0000";
      escrowAmt.textContent = `${amount} ETH`;
    }

    // Job Info
    const kvItems = document.querySelectorAll(".kv");
    kvItems.forEach((item) => {
      const label = item.querySelector(".k");
      if (!label) return;
      const value = item.querySelector(".v");
      if (!value) return;
      if (label.textContent === "Shipper") {
        value.textContent =
          agreement.shipper?.display_name || agreement.shipper_wallet || "—";
      } else if (label.textContent === "Deadline") {
        value.textContent = agreement.deadline
          ? new Date(agreement.deadline).toLocaleString()
          : "—";
      } else if (label.textContent === "Accepted") {
        value.textContent = agreement.carrier_accepted_at
          ? new Date(agreement.carrier_accepted_at).toLocaleString()
          : "—";
      } else if (label.textContent === "Contract") {
        value.textContent = agreement.contract_address || "0x7a83…4F2E";
      }
    });

    renderMilestoneTrack(currentMilestones);
    renderMilestoneList(currentMilestones, agreement.escrow_amount);
  }

  function renderMilestoneTrack(milestones) {
    milestones = [...milestones].sort(
      (a, b) => Number(a.milestone_index) - Number(b.milestone_index),
    );

    const trackContainer = document.querySelector(".track");
    if (!trackContainer) return;
    if (!milestones || milestones.length === 0) {
      trackContainer.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--text-faint);">No milestones defined.</div>';
      return;
    }
    const paidCount = milestones.filter((m) => m.status === "Paid").length;

    const progress =
      milestones.length > 1
        ? Math.max(0, (paidCount - 1) / (milestones.length - 1)) * 75
        : 0;

    let html = `<div class="track-fill" style="width:${progress}%"></div>`;
    const firstUnfinishedIndex = milestones.findIndex(
      (m) => m.status !== "Paid",
    );

    milestones.forEach((m, i) => {
      const status = m.status || "Pending";
      let cls = "tnode";

      if (status === "Paid" || status === "Verified") {
        cls += " complete";
      }

      if (i === firstUnfinishedIndex) {
        cls += " current";
      }
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

  function renderMilestoneList(milestones, totalWei) {
    milestones = [...milestones].sort(
      (a, b) => Number(a.milestone_index) - Number(b.milestone_index),
    );

    const container = document.getElementById("milestone-list");

    if (!container) return;
    if (!milestones || milestones.length === 0) {
      container.innerHTML =
        '<div style="padding:12px;color:var(--text-faint);">No milestones defined.</div>';
      return;
    }

    const totalEth = totalWei
      ? ethers.formatEther(BigInt(totalWei).toString())
      : 0;

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
      const isPaid = status === "Paid";
      const isSubmitted = status === "Submitted";
      const isVerified = status === "Verified";

      let cardClass = "milestone-card";

      if (isPaid) {
        cardClass += " milestone-paid";
      } else if (isSubmitted) {
        cardClass += " milestone-submitted";
      } else if (isVerified) {
        cardClass += " milestone-verified";
      } else {
        cardClass += " milestone-pending";
      }

      const icon = isPaid ? "✓" : isSubmitted ? "!" : isVerified ? "✓" : i + 1;

      html += `
  <div class="${cardClass}">
    <div class="milestone-icon">${icon}</div>

    <div class="milestone-info">
      <div class="milestone-title">
        ${m.description || `Milestone ${i + 1}`}
      </div>

      <div class="milestone-status">
        ${statusText}
      </div>
    </div>

    <div class="milestone-payout">
      <div class="milestone-amount">
        ${amt} ETH
      </div>

      <div class="milestone-percent">
        ${pct}% of escrow
      </div>

      <div class="milestone-status-label" style="color:${statusColor}">
        ${status}
      </div>
    </div>
  </div>
`;
    });
    container.innerHTML = html;
  }

  function setupActions(agreement) {
    const status = agreement.status || "PendingAcceptance";

    // Clear previously selected proof when refreshing agreement state
    selectedProofFile = null;

    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
      proofPreviewUrl = null;
    }

    const proofSection = document.getElementById("proof-section");

    if (!proofSection) return;

    // Always make sure the action section is visible
    proofSection.style.display = "block";

    // Restore the default proof UI before applying the current status
    proofSection.innerHTML = `
  <h3 id="proof-title">
    Submit Proof — Milestone <span id="proof-milestone-index">—</span>
  </h3>

  <input
    type="file"
    id="proof-file-input"
    accept="image/jpeg,image/png,image/webp"
    style="display:none;"
  >

  <div class="upload-box" id="proof-upload-box">
    📷 Click to upload delivery proof photo
  </div>

  <div id="proof-preview" style="display:none;"></div>

  <button class="btn btn-primary btn-block" id="submit-proof-btn" disabled>
    Submit Milestone Proof
  </button>

  <div id="completion-message" style="display:none;">
    <div class="completion-icon">✓</div>
    <div class="completion-title">Delivery Completed</div>
    <div class="completion-text">
      All milestones for this agreement have been completed.
      No further action is required.
    </div>
  </div>
`;

    // Hide proof section if not applicable (e.g., completed or pending acceptance)
    // Hide proof section only for terminated agreements
    if (
      status === "Rejected" ||
      status === "Cancelled" ||
      status === "Refunded" ||
      status === "Expired"
    ) {
      proofSection.style.display = "none";
      return;
    }
    if (status === "PendingAcceptance") {
      proofSection.innerHTML = `
        <h3>Job Offer — Pending Your Acceptance</h3>
        <div class="btn-row" style="margin-top:12px;">
          <button class="btn btn-primary" onclick="acceptAgreement()">Accept Job</button>
          <button class="btn btn-danger" onclick="rejectAgreement()">Decline Job</button>
        </div>
      `;
      return;
    }

    // ─── Agreement fully completed ───
    if (status === "Completed") {
      if (proofSection) {
        proofSection.innerHTML = `
        <h3>Delivery Completed</h3>

        <div id="completion-message">
          <div class="completion-icon">✓</div>
          <div class="completion-title">All milestones completed</div>
          <div class="completion-text">
            All milestones for this agreement have been completed.
            No further action is required.
          </div>
        </div>
      `;
      }

      return;
    }

    // Waiting for shipper to fund escrow
    if (status === "AwaitingFunding") {
      proofSection.innerHTML = `
    <h3>Awaiting Shipper Funding</h3>
    <p style="color:var(--text-faint); margin-top:8px;">
      Your job has been accepted. Please wait for the shipper
      to fund the escrow before submitting milestone proof.
    </p>
  `;

      return;
    }

    // Active agreement — handle milestone proof
    if (status === "Active") {
      const nextMilestoneIndex = currentMilestones.findIndex(
        (m) => m.status !== "Paid",
      );

      const nextMilestone =
        nextMilestoneIndex >= 0 ? currentMilestones[nextMilestoneIndex] : null;

      const label = proofSection.querySelector("h3");
      const upload = proofSection.querySelector("#proof-upload-box");
      const fileInput = proofSection.querySelector("#proof-file-input");
      const btn = proofSection.querySelector(".btn-primary");

      // All milestones completed
      if (!nextMilestone) {
        if (label) {
          label.textContent = "Delivery Completed";
        }

        if (upload) {
          upload.style.display = "none";
        }

        if (btn) {
          btn.style.display = "none";
        }

        const completionMessage = proofSection.querySelector(
          "#completion-message",
        );

        if (completionMessage) {
          completionMessage.style.display = "block";
        }

        return;
      }

      const milestoneIndex =
        nextMilestone.milestone_index !== undefined
          ? nextMilestone.milestone_index
          : nextMilestoneIndex;

      // ─── Waiting for shipper verification ───
      if (nextMilestone.status === "Submitted") {
        if (label) {
          label.textContent = "Awaiting Shipper Verification";
        }

        if (upload) {
          upload.style.opacity = "0.45";
          upload.style.cursor = "not-allowed";
          upload.style.pointerEvents = "none";
          upload.textContent =
            "📎 Proof submitted — waiting for shipper verification";
        }

        if (btn) {
          btn.disabled = true;
          btn.style.opacity = "0.45";
          btn.style.cursor = "not-allowed";
          btn.textContent = "Waiting for Verification";
          btn.onclick = null;
        }

        return;
      }

      // ─── Next milestone can be submitted ───
      if (nextMilestone.status === "Pending") {
        if (label) {
          label.textContent = `Submit Proof — ${
            nextMilestone.description || `Milestone ${milestoneIndex + 1}`
          }`;
        }

        if (upload && fileInput) {
          upload.onclick = function () {
            fileInput.click();
          };

          fileInput.onchange = function (event) {
            const file = event.target.files?.[0];

            if (!file) return;

            // Photo only
            if (!file.type.startsWith("image/")) {
              showToast("Please select an image file only.", "error");
              fileInput.value = "";
              return;
            }

            // Allow JPG, PNG and WebP only
            const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

            if (!allowedTypes.includes(file.type)) {
              showToast("Only JPG, PNG or WebP images are allowed.", "error");
              fileInput.value = "";
              return;
            }

            // Maximum 10 MB
            if (file.size > 10 * 1024 * 1024) {
              showToast("Photo must be smaller than 10 MB.", "error");
              fileInput.value = "";
              return;
            }

            selectedProofFile = file;

            // Remove old preview URL
            if (proofPreviewUrl) {
              URL.revokeObjectURL(proofPreviewUrl);
            }

            proofPreviewUrl = URL.createObjectURL(file);

            const preview = proofSection.querySelector("#proof-preview");
            const submitBtn = proofSection.querySelector("#submit-proof-btn");

            if (preview) {
              preview.style.display = "block";
              preview.innerHTML = `
        <div class="proof-preview-card">
          <img
            src="${proofPreviewUrl}"
            alt="Delivery proof preview"
            class="proof-preview-image"
          >

          <div class="proof-preview-info">
            <div class="proof-file-name">
              📷 ${file.name}
            </div>

            <button
              type="button"
              class="btn btn-ghost btn-sm"
              id="remove-proof-btn"
            >
              Remove / Replace
            </button>
          </div>
        </div>
      `;

              const removeBtn = preview.querySelector("#remove-proof-btn");

              if (removeBtn) {
                removeBtn.onclick = function () {
                  selectedProofFile = null;

                  if (proofPreviewUrl) {
                    URL.revokeObjectURL(proofPreviewUrl);
                    proofPreviewUrl = null;
                  }

                  fileInput.value = "";
                  preview.style.display = "none";
                  preview.innerHTML = "";

                  if (submitBtn) {
                    // ═══ YON — UI FIX ═══
                    submitBtn.disabled = true;
                    submitBtn.style.opacity = "0.45";
                    submitBtn.style.cursor = "not-allowed";
                    // ═══ YON End ═══
                  }

                  upload.innerHTML = "📷 Click to upload delivery proof photo";
                };
              }
            }

            if (submitBtn) {
              // ═══ YON — UI FIX ═══
              // The button's disabled state was cleared before, but its
              // dimmed opacity/cursor styles were not — reset them too so
              // the button visually becomes clickable after a photo is chosen.
              submitBtn.disabled = false;
              submitBtn.style.opacity = "1";
              submitBtn.style.cursor = "pointer";
              // ═══ YON End ═══
            }

            upload.innerHTML = "📷 Photo selected — click to replace";
          };
        }

        if (btn) {
          btn.disabled = !selectedProofFile;
          btn.style.opacity = selectedProofFile ? "1" : "0.45";
          btn.style.cursor = selectedProofFile ? "pointer" : "not-allowed";
          btn.textContent = "Submit Milestone Proof";

          btn.onclick = function () {
            if (!selectedProofFile) {
              showToast("Please upload a proof photo first.", "error");
              return;
            }

            submitMilestoneProof(milestoneIndex);
          };
        }
      }
    }
  }

  window.submitMilestoneProof = async function (milestoneIndex) {
    try {
      const agreementId = currentAgreement.onchain_id;
      if (!agreementId) throw new Error("No agreement ID");

      if (!selectedProofFile) {
        showToast("Please upload a proof photo first.", "error");
        return;
      }

      // Check wallet connection
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      const wallet = localStorage.getItem("traxenWallet");
      if (!wallet) {
        throw new Error("Wallet not connected.");
      }

      // ─── 1. Upload proof photo to Supabase ─────────────────────
      showToast("Uploading proof photo...", "info");

      const formData = new FormData();
      formData.append("proof", selectedProofFile);
      formData.append("agreementId", agreementId);
      formData.append("milestoneId", milestoneIndex);

      const uploadResponse = await fetch("/api/milestones/upload-proof", {
        method: "POST",
        headers: {
          "x-wallet-address": wallet,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || "Failed to upload proof photo");
      }

      console.log("✅ Proof uploaded:", uploadData);
      console.log("📷 Proof URL:", uploadData.proofUrl);

      // ─── 2. Submit milestone on blockchain ────────────────────
      if (typeof window.submitMilestone !== "function") {
        throw new Error("submitMilestone function not available");
      }

      showToast("Proof uploaded. Submitting milestone...", "info");

      const result = await window.submitMilestone(agreementId, milestoneIndex);

      console.log("✅ Milestone submitted on blockchain:", result);

      // ─── 3. Sync blockchain status to Supabase ────────────────
      const syncResponse = await fetch(`/api/agreements/${agreementId}`, {
        headers: {
          "x-wallet-address": wallet,
        },
      });

      if (!syncResponse.ok) {
        const errorData = await syncResponse.json();
        throw new Error(
          errorData.error || "Milestone submitted, but database sync failed",
        );
      }

      console.log("✅ Submitted milestone status synced to database");

      showToast("✅ Proof submitted successfully!", "success");

      // ─── 4. Refresh UI ────────────────────────────────────────
      selectedProofFile = null;

      if (proofPreviewUrl) {
        URL.revokeObjectURL(proofPreviewUrl);
        proofPreviewUrl = null;
      }

      await window.initAgreementDetails();
    } catch (error) {
      console.error("Submit proof error:", error);
      showToast(error.message || "Failed to submit proof", "error");
    }
  };

  window.acceptAgreement = async function () {
    try {
      const agreementId = currentAgreement.onchain_id;
      if (!agreementId) throw new Error("No agreement ID");
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      if (typeof window.acceptAgreementOnChain !== "function") {
        throw new Error("acceptAgreementOnChain function not available");
      }

      const buttons = document.querySelectorAll("#proof-section button");
      buttons.forEach((button) => {
        button.disabled = true;
        button.textContent = "Processing...";
      });

      showToast("Accepting agreement...", "info");

      const result = await window.acceptAgreementOnChain(agreementId);
      console.log("Accept result:", result);
      showToast("✅ Agreement accepted! Awaiting shipper funding.", "success");
      await window.initAgreementDetails();
    } catch (error) {
      console.error("Accept error:", error);
      showToast(error.message || "Failed to accept", "error");
    }
  };

  window.rejectAgreement = async function () {
    try {
      const agreementId = currentAgreement.onchain_id;
      if (!agreementId) throw new Error("No agreement ID");
      const sessionOk = await window.Auth.ensureFullSession();
      if (!sessionOk) return;

      if (typeof window.rejectAgreementOnChain !== "function") {
        throw new Error("rejectAgreementOnChain function not available");
      }

      if (!confirm("Are you sure you want to reject this agreement?")) return;
      showToast("Rejecting agreement...", "info");
      const result = await window.rejectAgreementOnChain(agreementId);
      console.log("Reject result:", result);
      showToast("Agreement rejected.", "warning");
      await window.initAgreementDetails();
    } catch (error) {
      console.error("Reject error:", error);
      showToast(error.message || "Failed to reject", "error");
    }
  };

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
    console.log(`[${type}] ${message}`);
  }

  // Auto-init if directly loaded
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
