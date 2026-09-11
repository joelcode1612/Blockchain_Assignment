// ─── CARRIER MILESTONE TRACKING ─────────────────────────────

(function () {
  window.initMilestoneTracking = async function () {
    const container = document.getElementById("milestone-tracking-list");

    if (!container) return;

    try {
      const sessionOk = await window.Auth.ensureFullSession();

      if (!sessionOk) return;

      const wallet =
        window.Session?.getWalletAddress?.() ||
        localStorage.getItem("traxenWallet");

      if (!wallet) {
        container.innerHTML = `
          <div class="tracking-empty">
            Wallet not connected.
          </div>
        `;
        return;
      }

      const token = localStorage.getItem("traxenAuthToken");
      const response = await fetch("/api/agreements", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-wallet-address": wallet.trim().toLowerCase(),
        },
      });

      if (!response.ok) {
        const err = await response.json();

        throw new Error(err.error || "Failed to fetch agreements");
      }

      const agreements = (await response.json())

        // Only accepted / ongoing agreements
        .filter(
          (ag) => ag.status === "Active" || ag.status === "AwaitingFunding",
        )

        .sort((a, b) => Number(a.onchain_id) - Number(b.onchain_id));

      renderMilestoneTracking(agreements);
    } catch (error) {
      console.error("Milestone tracking error:", error);

      container.innerHTML = `
        <div
          class="tracking-empty"
          style="color:var(--red);"
        >
          ❌ Failed to load milestone tracking:
          ${error.message}
        </div>
      `;
    }
  };

  function renderMilestoneTracking(agreements) {
    const container = document.getElementById("milestone-tracking-list");

    if (!container) return;

    if (!agreements.length) {
      container.innerHTML = `
        <div class="tracking-empty">

          <div class="tracking-empty-icon">
            ✓
          </div>

          <h3>
            No active milestone tracking
          </h3>

          <p>
            Accepted deliveries will appear here
            once you have an ongoing contract.
          </p>

        </div>
      `;

      return;
    }

    container.innerHTML = agreements
      .map((ag) => {
        const milestones = [...(ag.milestones || [])].sort(
          (a, b) => Number(a.milestone_index) - Number(b.milestone_index),
        );

        const paidCount = milestones.filter((m) => m.status === "Paid").length;

        const verifiedCount = milestones.filter(
          (m) => m.status === "Verified",
        ).length;

        const submittedCount = milestones.filter(
          (m) => m.status === "Submitted",
        ).length;

        const total = milestones.length;

        const progress = total ? Math.round((paidCount / total) * 100) : 0;

        const escrow =
          ag.escrow_amount != null
            ? Number(ethers.formatEther(String(ag.escrow_amount))).toFixed(4)
            : "0.0000";

        const released =
          ag.released_amount != null
            ? Number(ethers.formatEther(String(ag.released_amount))).toFixed(4)
            : "0.0000";

        const statusClass =
          ag.status === "Active"
            ? "tracking-status-active"
            : "tracking-status-waiting";

        const milestoneHtml = milestones.length
          ? milestones
              .map((m, index) => {
                const status = m.status || "Pending";

                let icon = index + 1;

                let milestoneClass = "tracking-milestone-pending";

                if (status === "Paid") {
                  icon = "✓";

                  milestoneClass = "tracking-milestone-paid";
                } else if (status === "Verified") {
                  icon = "✓";

                  milestoneClass = "tracking-milestone-verified";
                } else if (status === "Submitted") {
                  icon = "!";

                  milestoneClass = "tracking-milestone-submitted";
                }

                const pct = Number(m.payment_percentage || 0);

                const amount = ((Number(escrow) * pct) / 100).toFixed(4);

                return `
                    <div
                      class="tracking-milestone
                      ${milestoneClass}"
                    >

                      <div class="tracking-milestone-icon">
                        ${icon}
                      </div>

                      <div class="tracking-milestone-main">

                        <div class="tracking-milestone-title">
                          ${m.description || `Milestone ${index + 1}`}
                        </div>

                        <div class="tracking-milestone-meta">
                          ${pct}% of escrow ·
                          ${amount} ETH
                        </div>

                      </div>

                      <div class="tracking-milestone-status">
                        ${status}
                      </div>

                    </div>
                  `;
              })
              .join("")
          : `
              <div class="tracking-empty">
                No milestones defined.
              </div>
            `;

        return `
          <div class="tracking-card">

            <div class="tracking-card-head">

              <div>

                <div class="tracking-title">
                  #${ag.onchain_id} —
                  ${ag.agreement_name || "Agreement"}
                </div>

                <div class="tracking-sub">
                  Shipper:
                  ${ag.shipper?.display_name || ag.shipper_wallet || "Unknown"}
                </div>

              </div>


              <div class="${statusClass}">
                ${ag.status}
              </div>

            </div>


            <div class="tracking-summary">

              <div>
                <span>Escrow</span>
                <strong>
                  ${escrow} ETH
                </strong>
              </div>

              <div>
                <span>Released</span>
                <strong>
                  ${released} ETH
                </strong>
              </div>

              <div>
                <span>Milestones</span>
                <strong>
                  ${paidCount}/${total} Paid
                </strong>
              </div>

              <div>
                <span>Deadline</span>
                <strong>
                  ${
                    ag.deadline
                      ? new Date(ag.deadline).toLocaleDateString()
                      : "—"
                  }
                </strong>
              </div>

            </div>


            <div class="tracking-progress-row">

              <div class="tracking-progress-label">

                <span>
                  Delivery Progress
                </span>

                <strong>
                  ${progress}%
                </strong>

              </div>

              <div class="tracking-progress">

                <div
                  class="tracking-progress-fill"
                  style="width:${progress}%"
                ></div>

              </div>

            </div>


            <div class="tracking-counts">

              <span>
                ✓ ${paidCount} Paid
              </span>

              <span>
                ✓ ${verifiedCount} Verified
              </span>

              <span>
                ! ${submittedCount} Proof Submitted
              </span>

            </div>


            <div class="tracking-milestones">

              ${milestoneHtml}

            </div>


            <button
              class="btn btn-primary tracking-view-btn"
              onclick="
                window.loadPage(
                  'agreement_details',
                  { id: ${ag.onchain_id} }
                )
              "
            >
              View Agreement
            </button>

          </div>
        `;
      })
      .join("");
  }
})();
