let currentMilestoneId = null;

async function updateMilestoneAction(agreementId) {
    const button = document.getElementById("submit-proof-btn");
    const message = document.getElementById("milestone-action-message");
    const title = document.getElementById("submit-proof-title");
    const uploadBox = document.getElementById("proof-upload-box");

    if (!button || !message || !title) return;

    button.disabled = true;
    button.textContent = "Loading...";
    message.innerHTML = "";
    uploadBox.style.display = "block";

    try {
        const agreement = await window.getAgreement(agreementId);

        // Get ALL milestone statuses directly from blockchain
        const blockchainMilestones = [];

        for (let i = 0; i < agreement.milestoneCount; i++) {
            const milestone = await window.getMilestone(
                agreementId,
                i
            );

            blockchainMilestones.push(milestone);

            console.log(
                `Milestone ${i}:`,
                milestone,
                window.milestoneStatusToName(milestone.status)
            );
        }

        // -----------------------------------------
        // UPDATE BOTTOM MILESTONE LIST
        // -----------------------------------------

        const list = document.getElementById("milestone-list");

        if (list) {
            let html = "";

            blockchainMilestones.forEach((m, i) => {

                const percentage = Number(m.paymentPercentage || 0);

                const amount =
                    (
                        Number(agreement.escrowAmountETH) *
                        percentage /
                        100
                    ).toFixed(4);

                const statusName =
                    window.milestoneStatusToName(m.status);

                let description = "Not yet reached";
                let statusColor = "var(--text-faint)";

                if (statusName === "Submitted") {
                    description =
                        "Proof submitted — waiting for shipper verification";

                    statusColor = "var(--amber)";
                }

                else if (statusName === "Verified") {
                    description =
                        "Verified — waiting for shipper payment";

                    statusColor = "var(--blue)";
                }

                else if (statusName === "Paid") {
                    description = "Payment released";

                    statusColor = "var(--lime)";
                }

                html += `
                    <div class="milestone-row">

                        <div>
                            <div class="name">
                                ${i + 1}. Milestone ${i + 1}
                            </div>

                            <div class="sub">
                                ${description}
                            </div>
                        </div>

                        <div class="right">

                            <div class="amt">
                                ${amount} ETH
                            </div>

                            <div class="sub"
                                 style="color:${statusColor}">
                                ${statusName}
                            </div>

                        </div>

                    </div>
                `;
            });

            list.innerHTML = html;
        }

        // -----------------------------------------
        // FIND CURRENT MILESTONE
        // -----------------------------------------

        let activeMilestone = null;

        for (const milestone of blockchainMilestones) {

            if (milestone.status !== 3) {
                activeMilestone = milestone;
                break;
            }
        }

        // -----------------------------------------
        // ALL PAID
        // -----------------------------------------

        if (!activeMilestone) {

            currentMilestoneId = null;

            title.textContent = "Milestone Proof";

            message.innerHTML = `
                <div style="padding:12px; color:var(--text-faint);">
                    All milestones have been completed.
                </div>
            `;

            button.disabled = true;
            button.textContent = "All Milestones Completed";

            return;
        }

        currentMilestoneId =
            activeMilestone.milestoneId;

        // -----------------------------------------
        // PENDING
        // -----------------------------------------

        if (activeMilestone.status === 0) {

            title.textContent =
                `Submit Milestone ${currentMilestoneId + 1} Proof`;

            message.innerHTML = `
                <div style="padding:12px; color:var(--text-faint);">
                    Milestone ${currentMilestoneId + 1} is ready.
                    You can submit your proof.
                </div>
            `;

            button.disabled = false;
            button.textContent = "Submit Milestone Proof";
        }

        // -----------------------------------------
        // SUBMITTED
        // -----------------------------------------

        else if (activeMilestone.status === 1) {

            title.textContent =
                `Milestone ${currentMilestoneId + 1} Proof Submitted`;

            message.innerHTML = `
                <div style="padding:12px;">
                    <strong>Proof submitted successfully.</strong>

                    <div style="margin-top:6px; color:var(--text-faint);">
                        Waiting for the shipper to verify and release payment.
                    </div>
                </div>
            `;

            uploadBox.style.display = "none";

            button.disabled = true;
            button.textContent = "Waiting for Shipper";
        }

        // -----------------------------------------
        // VERIFIED
        // -----------------------------------------

        else if (activeMilestone.status === 2) {

            title.textContent =
                `Milestone ${currentMilestoneId + 1} Verified`;

            message.innerHTML = `
                <div style="padding:12px;">

                    <strong>Milestone verified.</strong>

                    <div style="margin-top:6px; color:var(--text-faint);">
                        Waiting for the shipper to release payment.
                    </div>

                </div>
            `;

            uploadBox.style.display = "none";

            button.disabled = true;
            button.textContent = "Waiting for Payment";
        }

    } catch (error) {

        console.error(
            "Failed to update milestone action:",
            error
        );

        button.disabled = true;
        button.textContent = "Unable to Load";

        message.innerHTML = `
            <div style="padding:12px; color:#ff5c5c;">
                Failed to load milestone status.
            </div>
        `;
    }
}


(function () {
    window.initCarrierAgreementDetails = async function () {
        try {
            const params = new URLSearchParams(window.location.search);
            const agreementId = params.get("id");

            if (!agreementId) {
                console.error("No agreement ID provided.");
                return;
            }

            const wallet = localStorage.getItem("traxenWallet");

            if (!wallet) {
                console.error("Wallet not connected.");
                return;
            }

            console.log("Loading carrier agreement:", agreementId);

            const response = await fetch(`/api/agreements/${agreementId}`, {
                headers: {
                    "x-wallet-address": wallet
                }
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to fetch agreement");
            }

            const agreement = await response.json();

            console.log("Agreement loaded:", agreement);
            console.log("🔥 MILESTONES:", agreement.milestones);
            console.table(agreement.milestones);

            // Agreement number
            const agreementTitle = document.getElementById("agreement-title");

            if (agreementTitle) {
                agreementTitle.innerHTML =
                    `Agreement #${agreement.onchain_id || agreementId}
                    <span class="pill ${getStatusClass(agreement.status)}"
                          style="margin-left:8px">
                        <span class="dot"></span>
                        ${agreement.status || "PendingAcceptance"}
                    </span>`;
            }

            // Subtitle
            const agreementSub = document.getElementById("agreement-sub");

            if (agreementSub) {
                agreementSub.textContent =
                    agreement.agreement_name ||
                    `${agreement.cargo_type || "Logistics"} · Shipper: ${
                        agreement.shipper?.display_name ||
                        agreement.shipper_wallet ||
                        "Unknown"
                    }`;
            }

            // Shipper
            const shipperName = document.getElementById("shipper-name");

            if (shipperName) {
                shipperName.textContent =
                    agreement.shipper?.display_name ||
                    agreement.shipper_wallet ||
                    "—";
            }

            // Deadline
            const deadline = document.getElementById("deadline-date");

            if (deadline) {
                deadline.textContent = agreement.deadline
                    ? new Date(agreement.deadline).toLocaleString()
                    : "—";
            }

            // Accepted
            const accepted = document.getElementById("accepted-date");

            if (accepted) {
                accepted.textContent = agreement.accepted_at
                    ? new Date(agreement.accepted_at).toLocaleString()
                    : "—";
            }

            // Contract
            const contract = document.getElementById("contract-address");

            if (contract) {
                contract.textContent =
                    agreement.contract_address || "—";
            }

            // Escrow
            const escrowAmount = agreement.escrow_amount
                ? parseFloat(
                    ethers.formatEther(String(agreement.escrow_amount))
                ).toFixed(4)
                : "0.0000";

            const escrow = document.getElementById("escrow-amount");

            if (escrow) {
                escrow.textContent = `${escrowAmount} ETH`;
            }

            const escrowStatus = document.getElementById("escrow-status");

            if (escrowStatus) {
                escrowStatus.textContent =
                    agreement.status === "Active"
                        ? "Locked"
                        : agreement.status || "Unknown";
            }

            // Milestones
            renderMilestones(
                agreement.milestones || [],
                parseFloat(escrowAmount)
            );

            await updateMilestoneAction(Number(agreementId));

        } catch (error) {
            console.error("Carrier agreement details error:", error);
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
            Expired: "red"
        };

        return map[status] || "gray";
    }


    function renderMilestones(milestones, totalEth) {

        const track = document.getElementById("milestone-track");
        const list = document.getElementById("milestone-list");

        if (!track || !list) {
            console.warn("Milestone containers not found.");
            return;
        }

        if (!milestones.length) {
            track.innerHTML = "No milestones defined.";
            list.innerHTML = "No milestones defined.";
            return;
        }

        let trackHtml = "";

        milestones.forEach((m, i) => {

            const status = m.status || "Pending";

            let cls = "tnode";

            if (status === "Paid" || status === "Verified") {
                cls += " complete";
            } else if (status === "Submitted") {
                cls += " current";
            }

            const dot =
                status === "Paid" || status === "Verified"
                    ? "✓"
                    : i + 1;

            trackHtml += `
                <div class="${cls}">
                    <div class="tdot">${dot}</div>
                    <div class="tname">
                        ${m.description || `Milestone ${i + 1}`}
                    </div>
                    <div class="tamt">
                        ${m.payment_percentage || 0}%
                    </div>
                </div>
            `;
        });

        const paidCount =
            milestones.filter(m => m.status === "Paid").length;

        const progress =
            (paidCount / milestones.length) * 100;

        track.innerHTML = `
            <div class="track">
                <div class="track-fill"
                     style="width:${progress}%">
                </div>

                ${trackHtml}
            </div>
        `;


        let listHtml = "";

        milestones.forEach((m, i) => {

            const percentage = m.payment_percentage || 0;

            const amount =
                ((totalEth * percentage) / 100).toFixed(4);

            const status = m.status || "Pending";

            let statusColor = "var(--text-faint)";

            if (status === "Paid") {
                statusColor = "var(--lime)";
            } else if (status === "Verified") {
                statusColor = "var(--blue)";
            } else if (status === "Submitted") {
                statusColor = "var(--amber)";
            }

            let description = "Not yet reached";

            if (status === "Submitted") {
                description = "Awaiting shipper verification";
            } else if (status === "Verified") {
                description = "Verified — ready for payment";
            } else if (status === "Paid") {
                description = "Paid";
            }

            listHtml += `
                <div class="milestone-row">

                    <div>
                        <div class="name">
                            ${i + 1}. ${m.description || `Milestone ${i + 1}`}
                        </div>

                        <div class="sub">
                            ${description}
                        </div>
                    </div>

                    <div class="right">

                        <div class="amt">
                            ${amount} ETH
                        </div>

                        <div class="sub"
                             style="color:${statusColor}">
                            ${status}
                        </div>

                    </div>

                </div>
            `;
        });

        list.innerHTML = listHtml;
    }


    // Direct-page initialization
    if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
    ) {
        window.initCarrierAgreementDetails();
    } else {
        document.addEventListener(
            "DOMContentLoaded",
            window.initCarrierAgreementDetails
        );
    }

})();

