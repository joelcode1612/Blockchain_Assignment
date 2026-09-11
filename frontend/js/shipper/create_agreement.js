/**
 * ============================================================
 * Create Agreement Frontend Logic (Blockchain Carriers)
 * ============================================================
 */

let currentEthBalance = 0;
let currentWalletAddress = null;

const MIN_DEADLINE_MINUTES = 60;

let milestones = [
  { name: "Pickup", desc: "Goods picked up from origin", pct: 30 },
  { name: "In Transit", desc: "Goods in transit", pct: 20 },
  { name: "Out for Delivery", desc: "Goods out for final delivery", pct: 20 },
  { name: "Delivered", desc: "Successfully delivered", pct: 30 },
];

// ─── Load Carriers from Blockchain ──────────────────────────
// ─── Load Carriers from Database + Verify Blockchain ─────────
async function loadCarriersFromBlockchain() {
  const carrierSelect = document.getElementById("f-carrier");
  const carrierStatus = document.getElementById("carrier-status");

  if (!carrierSelect) return;

  try {
    // ==========================================================
    // 1. CHECK AUTHENTICATED WALLET
    // ==========================================================

    const walletAddress =
      typeof window.Auth?.getWallet === "function"
        ? window.Auth.getWallet()
        : localStorage.getItem("traxenWallet");

    if (!walletAddress) {
      carrierSelect.innerHTML = `<option value="">Please connect your wallet first</option>`;

      if (carrierStatus) {
        carrierStatus.textContent = "Wallet connection required.";
      }

      return;
    }

    // ==========================================================
    // 2. SHOW LOADING STATE
    // ==========================================================

    carrierSelect.innerHTML = `<option value="">Loading verified carriers...</option>`;

    if (carrierStatus) {
      carrierStatus.textContent = "Loading carriers from database...";
    }

    // ==========================================================
    // 3. LOAD CARRIERS FROM DATABASE FIRST
    // ==========================================================

    const response = await fetch("/api/users/carriers", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch carriers: HTTP ${response.status}`);
    }

    const databaseCarriers = await response.json();

    console.log("📦 Carriers loaded from database:", databaseCarriers);

    if (!Array.isArray(databaseCarriers) || databaseCarriers.length === 0) {
      carrierSelect.innerHTML = `<option value="">No carriers available</option>`;

      if (carrierStatus) {
        carrierStatus.textContent =
          "No carriers are registered in the database.";
      }

      return;
    }

    // ==========================================================
    // 4. CHECK METAMASK
    // ==========================================================

    if (!window.ethereum) {
      throw new Error("MetaMask is not available.");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);

    // ==========================================================
    // 5. CHECK CURRENT NETWORK
    // ==========================================================

    const network = await provider.getNetwork();

    const currentChainId = Number(network.chainId);

    const EXPECTED_CHAIN_ID = 11155111; // Sepolia

    console.log("🌐 Current blockchain chain ID:", currentChainId);

    if (currentChainId !== EXPECTED_CHAIN_ID) {
      carrierSelect.innerHTML = `<option value="">Wrong blockchain network</option>`;

      if (carrierStatus) {
        carrierStatus.textContent = `Please switch MetaMask to Sepolia (Chain ID ${EXPECTED_CHAIN_ID}) to verify carriers.`;
      }

      return;
    }

    // ==========================================================
    // 6. ENSURE CURRENT CONTRACT EXISTS
    // ==========================================================

    if (!window.contract) {
      if (typeof window.initContract === "function") {
        await window.initContract();
      }
    }

    const contract =
      window.contract ||
      (typeof window.getContract === "function" ? window.getContract() : null);

    if (!contract) {
      throw new Error("Smart contract is not initialized.");
    }

    const contractAddress = await contract.getAddress();

    console.log("📄 Current contract:", contractAddress);

    // ==========================================================
    // 7. VERIFY DATABASE CARRIERS IN PARALLEL
    // ==========================================================

    if (carrierStatus) {
      carrierStatus.textContent =
        "Verifying carriers on the current Sepolia blockchain...";
    }

    const verificationResults = await Promise.all(
      databaseCarriers.map(async (carrier) => {
        try {
          // ----------------------------------------------------
          // Validate DB wallet
          // ----------------------------------------------------

          const dbWallet = carrier?.wallet_address;

          if (!dbWallet || !ethers.isAddress(dbWallet)) {
            console.warn("⚠️ Invalid carrier wallet in database:", dbWallet);

            return null;
          }

          const normalizedWallet = dbWallet.toLowerCase();

          // ----------------------------------------------------
          // Check blockchain registration
          // ----------------------------------------------------

          const isRegistered =
            await window.checkUserRegistered(normalizedWallet);

          if (!isRegistered) {
            console.warn(
              `⚠️ Carrier ${normalizedWallet} exists in DB but is not registered on the current blockchain.`,
            );

            return null;
          }

          // ----------------------------------------------------
          // Check blockchain role
          // ----------------------------------------------------

          const roleInfo = await window.getUserRole(normalizedWallet);

          if (!roleInfo || roleInfo.role !== "Carrier") {
            console.warn(
              `⚠️ Wallet ${normalizedWallet} is not a Carrier on the current blockchain.`,
            );

            return null;
          }

          // ----------------------------------------------------
          // Carrier is valid on current network
          // ----------------------------------------------------

          console.log(`✅ Carrier verified: ${normalizedWallet}`);

          return {
            ...carrier,

            wallet_address: normalizedWallet,

            blockchainVerified: true,

            blockchainChainId: currentChainId,

            blockchainContractAddress: contractAddress,
          };
        } catch (error) {
          console.warn(
            `❌ Failed to verify carrier ${
              carrier?.wallet_address || "unknown"
            }:`,
            error.reason || error.message,
          );

          return null;
        }
      }),
    );

    // ==========================================================
    // 8. KEEP ONLY VERIFIED CARRIERS
    // ==========================================================

    const verifiedCarriers = verificationResults.filter(Boolean);

    console.log("✅ Verified carriers:", verifiedCarriers);

    // ==========================================================
    // 9. DISPLAY ONLY VERIFIED CARRIERS
    // ==========================================================

    carrierSelect.innerHTML = `<option value="">-- Select a carrier --</option>`;

    verifiedCarriers.forEach((carrier) => {
      const option = document.createElement("option");

      option.value = carrier.wallet_address;

      const display =
        carrier.display_name || carrier.wallet_address.substring(0, 8) + "...";

      const email = carrier.email ? ` (${carrier.email})` : "";

      option.textContent = `${display}${email}`;

      carrierSelect.appendChild(option);
    });

    // ==========================================================
    // 10. STATUS
    // ==========================================================

    if (carrierStatus) {
      if (verifiedCarriers.length === 0) {
        carrierStatus.textContent =
          "No database carriers could be verified on the current Sepolia blockchain.";
      } else {
        carrierStatus.textContent = `${verifiedCarriers.length} verified carrier${
          verifiedCarriers.length === 1 ? "" : "s"
        } available.`;
      }
    }
  } catch (error) {
    console.error("❌ Failed to load and verify carriers:", error);

    carrierSelect.innerHTML = `<option value="">Unable to verify carriers</option>`;

    if (carrierStatus) {
      carrierStatus.textContent =
        error.message || "Failed to load and verify carriers.";
    }
  }
}

// ─── UI Navigation ──────────────────────────────────────
function goStep(n) {
  [1, 2, 3].forEach((i) => {
    const stepEl = document.getElementById("ws-" + i);
    if (stepEl) stepEl.style.display = i === n ? "block" : "none";
    const indicator = document.getElementById("stp-" + i);
    if (indicator) {
      indicator.classList.remove("current", "done");
      if (i < n) indicator.classList.add("done");
      if (i === n) indicator.classList.add("current");
    }
  });
  if (n === 2) renderMilestones();
  if (n === 3) fillReview();
}

async function nextFromStep1() {
  // 1. Validate basic fields
  const nameInput = document.getElementById("f-name");
  const carrierSelect = document.getElementById("f-carrier");
  const carrierOption = carrierSelect && carrierSelect.selectedOptions[0];

  if (!nameInput.value.trim()) {
    alert("Please enter an agreement name.");
    nameInput.focus();
    return;
  }

  if (!carrierOption || !carrierOption.value) {
    alert("Please select a carrier.");
    return;
  }

  if (!validatePayloadValue()) return;
  if (!validateDeadline()) return;

  // 2. Blockchain verification of the selected carrier
  const selectedAddress = carrierOption.value;
  try {
    // Check if the address is registered at all
    const isRegistered = await window.checkUserRegistered(selectedAddress);
    if (!isRegistered) {
      alert(
        "The selected carrier is not registered on the blockchain. Please choose another.",
      );
      return;
    }

    // Check that the role is actually Carrier
    const roleInfo = await window.getUserRole(selectedAddress);
    if (roleInfo.role !== "Carrier") {
      alert(
        "The selected address is not a Carrier on the blockchain. Please choose another.",
      );
      return;
    }
  } catch (error) {
    alert("Blockchain verification failed: " + error.message);
    return;
  }

  // 3. All validations passed – proceed to step 2
  goStep(2);
}

function nextFromStep2() {
  // ==========================================
  // Make sure milestones exist
  // ==========================================
  console.table(milestones);
  if (!Array.isArray(milestones) || milestones.length === 0) {
    alert("Please add at least one milestone.");

    goStep(2);
    return;
  }

  // ==========================================
  // Validate every milestone
  // ==========================================

  for (let i = 0; i < milestones.length; i++) {
    const milestone = milestones[i];

    const percentage = Number(milestone.pct);

    console.log(`Milestone ${i + 1}:`, milestone.pct, "=>", percentage);

    // Invalid number
    if (!Number.isFinite(percentage)) {
      alert(
        `Milestone ${i + 1} has an invalid percentage. Please enter a number.`,
      );

      goStep(2);
      return;
    }

    // Must be greater than zero
    if (percentage <= 0) {
      alert(`Milestone ${i + 1} must have a percentage greater than 0%.`);

      goStep(2);
      return;
    }

    // Cannot exceed 100
    if (percentage > 100) {
      alert(`Milestone ${i + 1} cannot exceed 100%.`);

      goStep(2);
      return;
    }
  }

  // ==========================================
  // Calculate total
  // ==========================================

  const totalPct = milestones.reduce((sum, milestone) => {
    return sum + Number(milestone.pct);
  }, 0);

  console.log("Milestone total:", totalPct);

  // ==========================================
  // Must equal exactly 100
  // ==========================================

  if (Math.abs(totalPct - 100) > 0.000001) {
    alert(
      `Milestone percentages must total exactly 100%. Current total: ${totalPct}%.`,
    );

    goStep(2);
    return;
  }

  // ==========================================
  // Continue to review
  // ==========================================

  goStep(3);
}

// ─── Milestone UI ───────────────────────────────────────
function renderMilestones() {
  const body = document.getElementById("milestoneBody");
  if (!body) return;

  body.innerHTML = "";
  milestones.forEach((m, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
  <td>
    <div class="m-badge">
      ${i + 1}
    </div>
  </td>

  <td>
    <input
      type="text"
      value="${m.name || ""}"
      class="m-name-input"
    >
  </td>

  <td>
    <input
      type="text"
      value="${m.desc || ""}"
      class="m-desc-input"
    >
  </td>

  <td>
    <input
      type="number"
      value="${m.pct ?? 0}"
      min="0"
      max="100"
      step="0.01"
      class="m-pct-input"
    >
  </td>

  <td>
    <span
      class="m-remove"
      style="
        cursor:pointer;
        color:var(--error, red);
      "
    >
      ✕
    </span>
  </td>
`;

    const inputs = tr.querySelectorAll("input");
    inputs[0].onchange = (e) => (m.name = e.target.value);
    inputs[1].onchange = (e) => (m.desc = e.target.value);
    inputs[2].oninput = (e) => {
      const rawValue = e.target.value.trim();

      // ==========================================
      // Empty input
      // ==========================================

      if (rawValue === "") {
        m.pct = 0;

        updatePct();

        return;
      }

      // ==========================================
      // Convert to number
      // ==========================================

      const value = Number(rawValue);

      // ==========================================
      // Invalid number
      // ==========================================

      if (!Number.isFinite(value)) {
        m.pct = NaN;

        updatePct();

        return;
      }

      // ==========================================
      // Valid number
      // ==========================================

      m.pct = value;

      updatePct();
    };

    tr.querySelector(".m-remove").onclick = () => {
      milestones.splice(i, 1);
      renderMilestones();
    };
    body.appendChild(tr);
  });
  updatePct();
}

function addMilestone() {
  milestones.push({ name: "New Milestone", desc: "", pct: 0 });
  renderMilestones();
}

function updatePct() {
  const total = milestones.reduce((sum, milestone) => {
    const value = Number(milestone.pct);

    if (!Number.isFinite(value)) {
      return sum;
    }

    return sum + value;
  }, 0);

  const el = document.getElementById("pctTotal");

  if (!el) {
    return;
  }

  el.textContent = `Total allocated: ${total}%`;

  el.className =
    "pct-total " + (Math.abs(total - 100) < 0.000001 ? "good" : "bad");
}

// ─── Main Submit & Blockchain Execution ─────────────────
async function submitCreateAgreement() {
  try {
    // =====================================================
    // 1. VALIDATE MILESTONES
    // =====================================================

    if (!Array.isArray(milestones) || milestones.length === 0) {
      alert("Please add at least one milestone.");

      goStep(2);

      return;
    }

    // Check every milestone
    for (let i = 0; i < milestones.length; i++) {
      const milestone = milestones[i];

      const percentage = parseFloat(milestone.pct);

      if (!Number.isFinite(percentage)) {
        alert(`Milestone ${i + 1} has an invalid payment percentage.`);

        goStep(2);

        return;
      }

      if (percentage <= 0 || percentage > 100) {
        alert(`Milestone ${i + 1} percentage must be between 0% and 100%.`);

        goStep(2);

        return;
      }
    }

    // =====================================================
    // 2. CALCULATE TOTAL PERCENTAGE
    // =====================================================

    const totalPct = milestones.reduce((sum, milestone) => {
      return sum + parseFloat(milestone.pct);
    }, 0);

    // =====================================================
    // 3. TOTAL MUST EQUAL 100%
    // =====================================================

    if (Math.abs(totalPct - 100) > 0.000001) {
      alert(
        `Milestone percentages must total exactly 100%. Current total: ${totalPct}%.`,
      );

      goStep(2);

      return;
    }

    // =====================================================
    // 2. GET FORM DATA
    // =====================================================

    const agreementName = document.getElementById("f-name").value.trim();

    const carrierSelect = document.getElementById("f-carrier");

    const carrierOption = carrierSelect?.selectedOptions[0];

    const cargoType = document.getElementById("f-cargo-type")?.value || null;
    const weightKg = document.getElementById("f-weight")?.value || null;

    if (!carrierOption) {
      alert("Please select a carrier.");

      goStep(1);

      return;
    }

    let carrierAddress = carrierOption.value;

    // =====================================================
    // 3. VALIDATE CARRIER WALLET
    // =====================================================

    if (!ethers.isAddress(carrierAddress)) {
      alert("Invalid carrier wallet address.");

      return;
    }

    // =====================================================
    // 4. GET ESCROW AMOUNT
    // =====================================================

    const totalAmountEth = parseFloat(document.getElementById("f-value").value);

    if (!totalAmountEth || totalAmountEth <= 0) {
      alert("Escrow amount must be greater than 0 ETH.");

      goStep(1);

      return;
    }

    // =====================================================
    // 5. GET DEADLINE
    // =====================================================

    const deadlineInput = document.getElementById("f-deadline").value;

    if (!deadlineInput) {
      alert("Please select a delivery deadline.");

      goStep(1);

      return;
    }

    const deadlineDate = new Date(deadlineInput);

    const deadlineTimestamp = Math.floor(deadlineDate.getTime() / 1000);

    if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
      alert("The deadline must be in the future.");

      goStep(1);

      return;
    }

    // =====================================================
    // 6. PREPARE MILESTONES
    // =====================================================

    const paymentPercentages = milestones.map((milestone) =>
      Number(milestone.pct),
    );

    const descriptions = milestones.map(
      (milestone) => milestone.desc || milestone.name,
    );

    console.log("Payment percentages:", paymentPercentages);

    console.log("Milestone descriptions:", descriptions);

    // =====================================================
    // 7. GET SHIPPER WALLET
    // =====================================================

    const shipperWallet = localStorage.getItem("traxenWallet");

    // if (!shipperWallet) {
    //   alert("Please connect your wallet first.");

    //   window.location.href = "/";

    //   return;
    // }

    // =====================================================
    // 8. CREATE AGREEMENT ON BLOCKCHAIN
    // =====================================================

    console.log("⏳ Creating agreement on blockchain...");

    // IMPORTANT:
    // createAgreement() accepts ONLY:
    // 1. carrierAddress
    // 2. totalAmountEth
    // 3. deadlineTimestamp
    // 4. paymentPercentages

    const blockchainResult = await createAgreement(
      carrierAddress,
      totalAmountEth,
      deadlineTimestamp,
      descriptions,
      paymentPercentages,
    );

    console.log("✅ Agreement created on blockchain:", blockchainResult);

    // Expected result:
    //
    // {
    //   agreementId,
    //   transactionHash
    // }

    // =====================================================
    // 9. SAVE AGREEMENT TO SUPABASE
    // =====================================================

    console.log("💾 Saving agreement metadata...");

    const token = localStorage.getItem("traxenAuthToken");

    if (!token) {
      throw new Error("Authentication token required.");
    }

    const dbResponse = await fetch("/api/agreements/create", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        onchainId: blockchainResult.agreementId,
        carrier: carrierAddress,
        totalAmountEth: totalAmountEth,
        descriptions: descriptions,
        percentages: paymentPercentages,
        deadlineTimestamp: deadlineTimestamp,
        createTx: blockchainResult.transactionHash,
        cargoType: cargoType,
        weightKg: weightKg,
        agreementName: agreementName,
      }),
    });

    // =====================================================
    // 10. CHECK DATABASE RESULT
    // =====================================================

    if (!dbResponse.ok) {
      const errorData = await dbResponse.json();

      console.error("Database synchronization failed:", errorData);

      throw new Error(errorData.error || "Failed to save agreement metadata");
    }

    const databaseResult = await dbResponse.json();

    console.log("✅ Agreement saved:", databaseResult);

    // =====================================================
    // 11. SUCCESS
    // =====================================================

    alert(
      "Agreement created successfully!\n\n" +
        "Waiting for the carrier to accept the agreement.",
    );

    // =====================================================
    // 12. REDIRECT
    // =====================================================

    // ═══ YON : deposit_balance page was removed; redirect to
    // the agreement detail page instead so the shipper can track the
    // acceptance / funding status of the new agreement. ═══
    window.location.href =
      "agreement_details_shipper.html?id=" + blockchainResult.agreementId;
    // ═══ YON End ═══
  } catch (error) {
    console.error("❌ Agreement creation error:", error);

    if (error.reason) {
      alert("Blockchain Error: " + error.reason);
    } else {
      alert(error.message || "Failed to create agreement.");
    }
  }
}

// ─── Fallback for openSuccess / openError ──────────────
if (typeof openSuccess !== "function") {
  window.openSuccess = (title, message, details, next) => {
    alert(`${title}\n${message}\n${details || ""}`);
    if (next) window.location.href = next;
  };
  window.openError = (title, message, details, code, retry) => {
    alert(`${title}\n${message}\n${details || ""}`);
    if (retry) window.location.href = retry;
  };
}

function fillReview() {
  const nameInput = document.getElementById("f-name");
  const carrierSelect = document.getElementById("f-carrier");
  const valueInput = document.getElementById("f-value");
  const deadlineInput = document.getElementById("f-deadline");

  // New Cargo Inputs
  const cargoTypeInput = document.getElementById("f-cargo-type");
  const weightInput = document.getElementById("f-weight");

  document.getElementById("rv-name").textContent =
    (nameInput && nameInput.value.trim()) || "Logistics Agreement";

  if (carrierSelect && carrierSelect.selectedOptions.length > 0) {
    document.getElementById("rv-carrier").textContent =
      carrierSelect.selectedOptions[0].textContent;
  }

  const val = (valueInput && valueInput.value) || "0.00";
  document.getElementById("rv-value").textContent = val + " ETH";

  const dl = deadlineInput ? deadlineInput.value : "";
  document.getElementById("rv-deadline").textContent = dl
    ? new Date(dl).toLocaleString()
    : "Not set";

  // Display Cargo Data
  document.getElementById("rv-cargo-type").textContent =
    (cargoTypeInput && cargoTypeInput.value.trim()) || "Not specified";

  document.getElementById("rv-weight").textContent =
    weightInput && weightInput.value.trim()
      ? `${weightInput.value} kg`
      : "Not specified";

  const wrap = document.getElementById("rv-milestones");
  if (!wrap) return;

  wrap.innerHTML = "";
  milestones.forEach((m, i) => {
    const amt = (((Number(val) || 0) * m.pct) / 100).toFixed(4);
    wrap.insertAdjacentHTML(
      "beforeend",
      `<div class="mini-milestone" style="display:flex; justify-content:space-between; margin-bottom:8px; padding:8px; background:rgba(255,255,255,0.03); border-radius:6px;">
        <div>
          <div class="name" style="font-weight:600;">${i + 1}. ${m.name}</div>
          <div class="sub" style="font-size:12px; color:var(--text-faint);">${m.desc}</div>
        </div>
        <div class="pct" style="font-weight:600; color:var(--lime);">${m.pct}% (${amt} ETH)</div>
      </div>`,
    );
  });
}

async function loadWalletBalance() {
  const balanceInfo = document.getElementById("eth-balance-info");

  const walletAddress = localStorage.getItem("traxenWallet");

  if (!walletAddress) {
    currentWalletAddress = null;
    currentEthBalance = 0;

    if (balanceInfo) {
      balanceInfo.textContent = "Wallet Balance: Wallet not connected";
    }

    return;
  }

  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    currentWalletAddress = walletAddress;

    const provider = new ethers.BrowserProvider(window.ethereum);

    // ---------------------------------------------
    // Get latest blockchain balance
    // ---------------------------------------------

    const balance = await provider.getBalance(walletAddress);

    currentEthBalance = Number(ethers.formatEther(balance));

    // ---------------------------------------------
    // Display balance
    // ---------------------------------------------

    if (balanceInfo) {
      balanceInfo.textContent = `Wallet Balance: ${currentEthBalance.toFixed(6)} ETH`;
    }

    // Revalidate payload after balance update
    validatePayloadValue();
  } catch (error) {
    console.error("Failed to load ETH balance:", error);

    currentEthBalance = 0;

    if (balanceInfo) {
      balanceInfo.textContent = "Wallet Balance: Unable to load";
    }
  }
}

// =====================================================
// VALIDATE PAYLOAD VALUE
// =====================================================

function validatePayloadValue() {
  const input = document.getElementById("f-value");

  const error = document.getElementById("eth-validation");

  if (!input || !error) {
    return false;
  }

  const amount = Number(input.value);

  // Reset
  error.style.display = "none";
  error.textContent = "";

  input.classList.remove("input-valid", "input-invalid");

  // ---------------------------------------------
  // Empty
  // ---------------------------------------------

  if (input.value.trim() === "") {
    showEthError("Please enter the escrow amount.");

    return false;
  }

  // ---------------------------------------------
  // Invalid number
  // ---------------------------------------------

  if (!Number.isFinite(amount)) {
    showEthError("Please enter a valid ETH amount.");

    return false;
  }

  // ---------------------------------------------
  // Must be greater than zero
  // ---------------------------------------------

  if (amount <= 0) {
    showEthError("Escrow amount must be greater than 0 ETH.");

    return false;
  }

  // ---------------------------------------------
  // Check wallet connection
  // ---------------------------------------------

  if (!currentWalletAddress) {
    showEthError("Please connect your MetaMask wallet first.");

    return false;
  }

  // ---------------------------------------------
  // Check real-time ETH balance
  // ---------------------------------------------

  if (amount > currentEthBalance) {
    showEthError(
      `Insufficient ETH balance. You need ${amount.toFixed(
        6,
      )} ETH, but your wallet has only ${currentEthBalance.toFixed(6)} ETH.`,
    );

    return false;
  }

  // ---------------------------------------------
  // Valid
  // ---------------------------------------------

  input.classList.add("input-valid");

  return true;
}

function showEthError(message) {
  const error = document.getElementById("eth-validation");

  const input = document.getElementById("f-value");

  if (error) {
    error.textContent = message;

    error.style.display = "block";
  }

  if (input) {
    input.classList.add("input-invalid");
  }
}

// =====================================================
// SET MINIMUM DEADLINE
// =====================================================

function setMinimumDeadline() {
  const deadlineInput = document.getElementById("f-deadline");

  if (!deadlineInput) {
    return;
  }

  const minimumTime = new Date(Date.now() + MIN_DEADLINE_MINUTES * 60 * 1000);

  // datetime-local requires:
  // YYYY-MM-DDTHH:mm

  const year = minimumTime.getFullYear();

  const month = String(minimumTime.getMonth() + 1).padStart(2, "0");

  const day = String(minimumTime.getDate()).padStart(2, "0");

  const hours = String(minimumTime.getHours()).padStart(2, "0");

  const minutes = String(minimumTime.getMinutes()).padStart(2, "0");

  const minimumValue = `${year}-${month}-${day}T${hours}:${minutes}`;

  deadlineInput.min = minimumValue;
}

// =====================================================
// VALIDATE DEADLINE
// =====================================================

function validateDeadline() {
  const input = document.getElementById("f-deadline");
  const error = document.getElementById("deadline-validation");
  const hint = document.getElementById("deadline-info");

  if (!input) return false;

  error.style.display = "none";
  error.textContent = "";
  input.classList.remove("input-valid", "input-invalid");

  if (!input.value) {
    showDeadlineError("Please select a delivery deadline.");
    return false;
  }

  const deadline = new Date(input.value);
  if (isNaN(deadline.getTime())) {
    showDeadlineError("Please enter a valid deadline.");
    return false;
  }

  //  const minDeadline = new Date(Date.now() + 60 * 60 * 1000);
  const minDeadline = new Date(Date.now() + 1 * 60 * 1000);

  if (deadline <= minDeadline) {
    showDeadlineError("Delivery deadline must be at least 1 hour from now.");
    return false;
  }

  // ✅ Valid
  input.classList.add("input-valid");
  if (hint) {
    hint.textContent = "✅ Deadline is valid";
    hint.style.color = "var(--lime)";
  }
  return true;
}

function showDeadlineError(message) {
  const error = document.getElementById("deadline-validation");

  const input = document.getElementById("f-deadline");

  if (error) {
    error.textContent = message;

    error.style.display = "block";
  }

  if (input) {
    input.classList.add("input-invalid");
  }
}

// =====================================================
// CENTRAL INITIALISATION FUNCTION
// =====================================================

function initCreateAgreement() {
  setMinimumDeadline();
  loadWalletBalance().then(() => {
    validatePayloadValue();
  });
  loadCarriersFromBlockchain();
  validateDeadline();

  const valueInput = document.getElementById("f-value");
  if (valueInput) {
    valueInput.addEventListener("input", validatePayloadValue);
  }

  const deadlineInput = document.getElementById("f-deadline");
  if (deadlineInput) {
    deadlineInput.addEventListener("input", validateDeadline);
  }

  window.addEventListener("walletConnected", loadWalletBalance);

  console.log("✅ Create Agreement page initialized (blockchain carriers)");
}

// ─── Expose for SPA Router ──────────────────────────────
window.initCreateAgreement = initCreateAgreement;

// ─── Auto‑init on direct page load ────────────────────
if (document.getElementById("f-carrier")) {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    initCreateAgreement();
  } else {
    document.addEventListener("DOMContentLoaded", initCreateAgreement);
  }
}
