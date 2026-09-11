/**
 * ============================================================
 * CREATE AGREEMENT FRONTEND LOGIC
 * Shipper SPA
 *
 * Flow:
 * 1. Load carriers from DATABASE
 * 2. Verify every carrier on CURRENT Sepolia blockchain
 * 3. Display ONLY verified carriers
 * 4. Validate every Step 1 input
 * 5. Validate every milestone
 * 6. Validate everything again before blockchain transaction
 * 7. Save blockchain result to database with JWT
 * ============================================================
 */

let currentEthBalance = 0;
let currentWalletAddress = null;

const MIN_DEADLINE_MINUTES = 60;
const EXPECTED_CHAIN_ID = 11155111;

const MAX_AGREEMENT_NAME_LENGTH = 100;
const MAX_CARGO_TYPE_LENGTH = 100;
const MAX_WEIGHT_KG = 1000000000;
const MAX_MILESTONE_NAME_LENGTH = 80;
const MAX_MILESTONE_DESC_LENGTH = 250;

let milestones = [
  {
    name: "Pickup",
    desc: "Goods picked up from origin",
    pct: 30,
  },
  {
    name: "In Transit",
    desc: "Goods in transit",
    pct: 20,
  },
  {
    name: "Out for Delivery",
    desc: "Goods out for final delivery",
    pct: 20,
  },
  {
    name: "Delivered",
    desc: "Successfully delivered",
    pct: 30,
  },
];

/* ============================================================
   HELPERS
   ============================================================ */

function getAuthToken() {
  return typeof window.getAuthToken === "function"
    ? window.getAuthToken()
    : localStorage.getItem("traxenAuthToken");
}

function getAuthenticatedWallet() {
  return typeof window.Auth?.getWallet === "function"
    ? window.Auth.getWallet()
    : localStorage.getItem("traxenWallet");
}

function setElementText(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}

function getElementValue(id) {
  const el = document.getElementById(id);

  if (!el) {
    return null;
  }

  return typeof el.value === "string"
    ? el.value.trim()
    : el.value;
}

function getCurrentProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not available.");
  }

  return new ethers.BrowserProvider(window.ethereum);
}

async function getCurrentNetwork() {
  const provider = getCurrentProvider();
  return provider.getNetwork();
}

async function ensureSepoliaNetwork() {
  const network = await getCurrentNetwork();

  const chainId = Number(network.chainId);

  console.log("🌐 Current chain ID:", chainId);

  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Wrong network. Please switch MetaMask to Sepolia (Chain ID ${EXPECTED_CHAIN_ID}).`,
    );
  }

  return {
    provider: getCurrentProvider(),
    chainId,
  };
}

/* ============================================================
   LOAD CARRIERS
   DATABASE FIRST -> BLOCKCHAIN VERIFICATION -> DISPLAY
   ============================================================ */

async function loadCarriersFromBlockchain() {
  const carrierSelect =
    document.getElementById("f-carrier");

  const carrierStatus =
    document.getElementById("carrier-status");

  if (!carrierSelect) {
    console.warn(
      "⏭️ f-carrier not found. Skipping carrier initialization.",
    );
    return;
  }

  try {
    /* --------------------------------------------------------
       1. CHECK AUTHENTICATED WALLET
       -------------------------------------------------------- */

    const walletAddress = getAuthenticatedWallet();

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      carrierSelect.innerHTML =
        `<option value="">Please connect your wallet first</option>`;

      if (carrierStatus) {
        carrierStatus.textContent =
          "Authenticated wallet required.";
      }

      return;
    }

    /* --------------------------------------------------------
       2. LOADING
       -------------------------------------------------------- */

    carrierSelect.innerHTML =
      `<option value="">Loading verified carriers...</option>`;

    if (carrierStatus) {
      carrierStatus.textContent =
        "Loading carriers from database...";
    }

    /* --------------------------------------------------------
       3. DATABASE
       -------------------------------------------------------- */

    const response = await fetch(
      "/api/users/carriers",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch carriers: HTTP ${response.status}`,
      );
    }

    const databaseCarriers =
      await response.json();

    console.log(
      "📦 Carriers loaded from database:",
      databaseCarriers,
    );

    if (
      !Array.isArray(databaseCarriers) ||
      databaseCarriers.length === 0
    ) {
      carrierSelect.innerHTML =
        `<option value="">No carriers available</option>`;

      if (carrierStatus) {
        carrierStatus.textContent =
          "No carriers are registered in the database.";
      }

      return;
    }

    /* --------------------------------------------------------
       4. CURRENT BLOCKCHAIN
       -------------------------------------------------------- */

    if (!window.ethereum) {
      throw new Error(
        "MetaMask is not available.",
      );
    }

    const {
      provider,
      chainId,
    } = await ensureSepoliaNetwork();

    /* --------------------------------------------------------
       5. CURRENT CONTRACT
       -------------------------------------------------------- */

    if (!window.contract) {
      if (
        typeof window.initContract === "function"
      ) {
        await window.initContract();
      }
    }

    const contract =
      window.contract ||
      (
        typeof window.getContract === "function"
          ? window.getContract()
          : null
      );

    if (!contract) {
      throw new Error(
        "Smart contract is not initialized.",
      );
    }

    const contractAddress =
      await contract.getAddress();

    console.log(
      "📄 Current contract:",
      contractAddress,
    );

    if (carrierStatus) {
      carrierStatus.textContent =
        "Verifying carriers on the current Sepolia blockchain...";
    }

    /* --------------------------------------------------------
       6. VERIFY ALL DB CARRIERS IN PARALLEL
       -------------------------------------------------------- */

    const results = await Promise.all(
      databaseCarriers.map(
        async (carrier) => {
          try {
            const dbWallet =
              carrier?.wallet_address;

            /* Invalid DB wallet */

            if (
              !dbWallet ||
              !ethers.isAddress(dbWallet)
            ) {
              console.warn(
                "⚠️ Invalid carrier wallet in database:",
                dbWallet,
              );

              return null;
            }

            const normalizedWallet =
              dbWallet.toLowerCase();

            /* Blockchain registration */

            if (
              typeof window.checkUserRegistered !==
              "function"
            ) {
              throw new Error(
                "checkUserRegistered() is unavailable.",
              );
            }

            const isRegistered =
              await window.checkUserRegistered(
                normalizedWallet,
              );

            if (!isRegistered) {
              console.warn(
                `⚠️ Carrier ${normalizedWallet} exists in DB but is not registered on the current blockchain.`,
              );

              return null;
            }

            /* Blockchain role */

            if (
              typeof window.getUserRole !==
              "function"
            ) {
              throw new Error(
                "getUserRole() is unavailable.",
              );
            }

            const roleInfo =
              await window.getUserRole(
                normalizedWallet,
              );

            if (
              !roleInfo ||
              roleInfo.role !== "Carrier"
            ) {
              console.warn(
                `⚠️ ${normalizedWallet} is not a Carrier on the current blockchain.`,
              );

              return null;
            }

            console.log(
              `✅ Carrier verified: ${normalizedWallet}`,
            );

            return {
              ...carrier,
              wallet_address:
                normalizedWallet,
              blockchainVerified: true,
              blockchainChainId: chainId,
              blockchainContractAddress:
                contractAddress,
            };
          } catch (error) {
            console.warn(
              `❌ Failed to verify carrier ${
                carrier?.wallet_address ||
                "unknown"
              }:`,
              error.reason ||
                error.message,
            );

            return null;
          }
        },
      ),
    );

    /* --------------------------------------------------------
       7. KEEP ONLY VERIFIED CARRIERS
       -------------------------------------------------------- */

    const verifiedCarriers =
      results.filter(Boolean);

    console.log(
      "✅ Verified carriers:",
      verifiedCarriers,
    );

    /* --------------------------------------------------------
       8. DISPLAY ONLY VERIFIED CARRIERS
       -------------------------------------------------------- */

    carrierSelect.innerHTML =
      `<option value="">-- Select a carrier --</option>`;

    verifiedCarriers.forEach(
      (carrier) => {
        const option =
          document.createElement(
            "option",
          );

        option.value =
          carrier.wallet_address;

        const display =
          carrier.display_name ||
          `${carrier.wallet_address.substring(
            0,
            8,
          )}...`;

        const email =
          carrier.email
            ? ` (${carrier.email})`
            : "";

        option.textContent =
          `${display}${email}`;

        carrierSelect.appendChild(
          option,
        );
      },
    );

    /* --------------------------------------------------------
       9. STATUS
       -------------------------------------------------------- */

    if (carrierStatus) {
      if (verifiedCarriers.length === 0) {
        carrierStatus.textContent =
          "No database carriers could be verified on the current Sepolia blockchain.";
      } else {
        carrierStatus.textContent =
          `${verifiedCarriers.length} verified carrier${
            verifiedCarriers.length === 1
              ? ""
              : "s"
          } available.`;
      }
    }
  } catch (error) {
    console.error(
      "❌ Failed to load and verify carriers:",
      error,
    );

    carrierSelect.innerHTML =
      `<option value="">Unable to verify carriers</option>`;

    if (carrierStatus) {
      carrierStatus.textContent =
        error.message ||
        "Failed to load and verify carriers.";
    }
  }
}

/* ============================================================
   STEP NAVIGATION
   ============================================================ */

function goStep(stepNumber) {
  [1, 2, 3].forEach(
    (i) => {
      const step =
        document.getElementById(
          `ws-${i}`,
        );

      if (step) {
        step.style.display =
          i === stepNumber
            ? "block"
            : "none";
      }

      const indicator =
        document.getElementById(
          `stp-${i}`,
        );

      if (indicator) {
        indicator.classList.remove(
          "current",
          "done",
        );

        if (i < stepNumber) {
          indicator.classList.add(
            "done",
          );
        }

        if (i === stepNumber) {
          indicator.classList.add(
            "current",
          );
        }
      }
    },
  );

  if (stepNumber === 2) {
    renderMilestones();
  }

  if (stepNumber === 3) {
    fillReview();
  }
}

/* ============================================================
   STEP 1 VALIDATION
   ============================================================ */

async function nextFromStep1() {
  const nameInput =
    document.getElementById("f-name");

  const carrierSelect =
    document.getElementById("f-carrier");

  const cargoTypeInput =
    document.getElementById("f-cargo-type");

  const weightInput =
    document.getElementById("f-weight");

  /* ----------------------------------------------------------
     Required DOM elements
     ---------------------------------------------------------- */

  if (!nameInput) {
    alert(
      "Agreement name field is missing. Please reload the page.",
    );
    return;
  }

  if (!carrierSelect) {
    alert(
      "Carrier field is missing. Please reload the page.",
    );
    return;
  }

  if (!cargoTypeInput) {
    alert(
      "Cargo type field is missing. Please reload the page.",
    );
    return;
  }

  if (!weightInput) {
    alert(
      "Weight field is missing. Please reload the page.",
    );
    return;
  }

  /* ----------------------------------------------------------
     Agreement Name
     ---------------------------------------------------------- */

  const agreementName =
    nameInput.value.trim();

  if (!agreementName) {
    alert(
      "Please enter an agreement name.",
    );
    nameInput.focus();
    return;
  }

  if (
    agreementName.length >
    MAX_AGREEMENT_NAME_LENGTH
  ) {
    alert(
      `Agreement name must be ${MAX_AGREEMENT_NAME_LENGTH} characters or fewer.`,
    );
    nameInput.focus();
    return;
  }

  /* ----------------------------------------------------------
     Carrier
     ---------------------------------------------------------- */

  const carrierOption =
    carrierSelect.selectedOptions?.[0];

  if (
    !carrierOption ||
    !carrierOption.value
  ) {
    alert(
      "Please select a carrier.",
    );
    carrierSelect.focus();
    return;
  }

  const selectedCarrier =
    carrierOption.value.trim();

  if (
    !ethers.isAddress(selectedCarrier)
  ) {
    alert(
      "The selected carrier wallet address is invalid.",
    );
    carrierSelect.focus();
    return;
  }

  /* ----------------------------------------------------------
     Cargo Type
     ---------------------------------------------------------- */

  const cargoType =
    cargoTypeInput.value.trim();

  if (!cargoType) {
    alert(
      "Please enter the cargo type.",
    );
    cargoTypeInput.focus();
    return;
  }

  if (
    cargoType.length >
    MAX_CARGO_TYPE_LENGTH
  ) {
    alert(
      `Cargo type must be ${MAX_CARGO_TYPE_LENGTH} characters or fewer.`,
    );
    cargoTypeInput.focus();
    return;
  }

  /* ----------------------------------------------------------
     Weight
     ---------------------------------------------------------- */

  const weightRaw =
    weightInput.value.trim();

  if (!weightRaw) {
    alert(
      "Please enter the cargo weight.",
    );
    weightInput.focus();
    return;
  }

  const weightKg =
    Number(weightRaw);

  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0
  ) {
    alert(
      "Cargo weight must be a valid number greater than 0 kg.",
    );
    weightInput.focus();
    return;
  }

  if (
    weightKg > MAX_WEIGHT_KG
  ) {
    alert(
      "Cargo weight is too large.",
    );
    weightInput.focus();
    return;
  }

  /* ----------------------------------------------------------
     Escrow Amount
     ---------------------------------------------------------- */

  if (!validatePayloadValue()) {
    return;
  }

  /* ----------------------------------------------------------
     Deadline
     ---------------------------------------------------------- */

  if (!validateDeadline()) {
    return;
  }

  /* ----------------------------------------------------------
     Blockchain verification
     ---------------------------------------------------------- */

  try {
    const {
      chainId,
    } = await ensureSepoliaNetwork();

    console.log(
      "✅ Step 1 network verified:",
      chainId,
    );

    const accounts =
      await window.ethereum.request({
        method: "eth_accounts",
      });

    const activeWallet =
      accounts?.[0] || null;

    if (!activeWallet) {
      alert(
        "Please connect your MetaMask wallet first.",
      );
      return;
    }

    const authenticatedWallet =
      getAuthenticatedWallet();

    if (
      !authenticatedWallet ||
      !ethers.isAddress(
        authenticatedWallet,
      )
    ) {
      alert(
        "Authenticated Shipper wallet is not available.",
      );
      return;
    }

    if (
      activeWallet.toLowerCase() !==
      authenticatedWallet.toLowerCase()
    ) {
      alert(
        "Your MetaMask account does not match the authenticated Shipper account.",
      );
      return;
    }

    if (
      typeof window.checkUserRegistered !==
      "function" ||
      typeof window.getUserRole !==
      "function"
    ) {
      alert(
        "Blockchain carrier verification functions are unavailable.",
      );
      return;
    }

    const registered =
      await window.checkUserRegistered(
        selectedCarrier,
      );

    if (!registered) {
      alert(
        "The selected carrier is not registered on the current blockchain.",
      );
      return;
    }

    const role =
      await window.getUserRole(
        selectedCarrier,
      );

    if (
      !role ||
      role.role !== "Carrier"
    ) {
      alert(
        "The selected wallet is not a Carrier on the current blockchain.",
      );
      return;
    }

    console.log(
      "✅ Selected carrier passed blockchain verification.",
    );
  } catch (error) {
    console.error(
      "Step 1 blockchain verification failed:",
      error,
    );

    alert(
      "Blockchain verification failed: " +
        (error.reason ||
          error.message),
    );

    return;
  }

  goStep(2);
}

/* ============================================================
   STEP 2 VALIDATION
   ============================================================ */

function validateMilestones() {
  if (
    !Array.isArray(milestones) ||
    milestones.length === 0
  ) {
    alert(
      "Please add at least one milestone.",
    );
    return false;
  }

  for (
    let i = 0;
    i < milestones.length;
    i++
  ) {
    const milestone =
      milestones[i];

    const number = i + 1;

    const name =
      String(
        milestone?.name || "",
      ).trim();

    const desc =
      String(
        milestone?.desc || "",
      ).trim();

    const pct =
      Number(
        milestone?.pct,
      );

    milestone.name = name;
    milestone.desc = desc;
    milestone.pct = pct;

    /* Name */

    if (!name) {
      alert(
        `Milestone ${number}: please enter a milestone name.`,
      );

      return false;
    }

    if (
      name.length >
      MAX_MILESTONE_NAME_LENGTH
    ) {
      alert(
        `Milestone ${number}: name must be ${MAX_MILESTONE_NAME_LENGTH} characters or fewer.`,
      );

      return false;
    }

    /* Description */

    if (!desc) {
      alert(
        `Milestone ${number}: please enter a milestone description.`,
      );

      return false;
    }

    if (
      desc.length >
      MAX_MILESTONE_DESC_LENGTH
    ) {
      alert(
        `Milestone ${number}: description must be ${MAX_MILESTONE_DESC_LENGTH} characters or fewer.`,
      );

      return false;
    }

    /* Percentage */

    if (!Number.isFinite(pct)) {
      alert(
        `Milestone ${number}: percentage must be a valid number.`,
      );

      return false;
    }

    if (pct <= 0) {
      alert(
        `Milestone ${number}: percentage must be greater than 0%.`,
      );

      return false;
    }

    if (pct > 100) {
      alert(
        `Milestone ${number}: percentage cannot exceed 100%.`,
      );

      return false;
    }
  }

  /* Total */

  const total =
    milestones.reduce(
      (sum, milestone) =>
        sum +
        Number(
          milestone.pct,
        ),
      0,
    );

  if (
    Math.abs(total - 100) >
    0.000001
  ) {
    alert(
      `Milestone percentages must total exactly 100%. Current total: ${total}%.`,
    );

    return false;
  }

  return true;
}

function nextFromStep2() {
  if (!validateMilestones()) {
    goStep(2);
    return;
  }

  goStep(3);
}

/* ============================================================
   MILESTONE UI
   ============================================================ */

function renderMilestones() {
  const body =
    document.getElementById(
      "milestoneBody",
    );

  if (!body) {
    return;
  }

  body.innerHTML = "";

  milestones.forEach(
    (milestone, index) => {
      const row =
        document.createElement(
          "tr",
        );

      row.innerHTML = `
        <td>
          <div class="m-badge">
            ${index + 1}
          </div>
        </td>

        <td>
          <input
            type="text"
            value="${escapeHtmlAttribute(
              milestone.name || "",
            )}"
            class="m-name-input"
            maxlength="${MAX_MILESTONE_NAME_LENGTH}"
          >
        </td>

        <td>
          <input
            type="text"
            value="${escapeHtmlAttribute(
              milestone.desc || "",
            )}"
            class="m-desc-input"
            maxlength="${MAX_MILESTONE_DESC_LENGTH}"
          >
        </td>

        <td>
          <input
            type="number"
            value="${Number(
              milestone.pct || 0,
            )}"
            class="m-pct-input"
            min="0.01"
            max="100"
            step="0.01"
          >
        </td>

        <td>
          <button
            type="button"
            class="m-remove"
          >
            ✕
          </button>
        </td>
      `;

      const inputs =
        row.querySelectorAll(
          "input",
        );

      const nameInput =
        inputs[0];

      const descInput =
        inputs[1];

      const pctInput =
        inputs[2];

      if (nameInput) {
        nameInput.addEventListener(
          "input",
          (event) => {
            milestone.name =
              event.target.value;
          },
        );
      }

      if (descInput) {
        descInput.addEventListener(
          "input",
          (event) => {
            milestone.desc =
              event.target.value;
          },
        );
      }

      if (pctInput) {
        pctInput.addEventListener(
          "input",
          (event) => {
            const raw =
              event.target.value.trim();

            milestone.pct =
              raw === ""
                ? 0
                : Number(raw);

            updatePct();
          },
        );
      }

      const removeButton =
        row.querySelector(
          ".m-remove",
        );

      if (removeButton) {
        removeButton.addEventListener(
          "click",
          () => {
            milestones.splice(
              index,
              1,
            );

            renderMilestones();
          },
        );
      }

      body.appendChild(row);
    },
  );

  updatePct();
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function addMilestone() {
  milestones.push({
    name: "",
    desc: "",
    pct: 0,
  });

  renderMilestones();
}

function updatePct() {
  const total =
    milestones.reduce(
      (sum, milestone) => {
        const value =
          Number(
            milestone?.pct,
          );

        return Number.isFinite(
          value,
        )
          ? sum + value
          : sum;
      },
      0,
    );

  const element =
    document.getElementById(
      "pctTotal",
    );

  if (!element) {
    return;
  }

  element.textContent =
    `Total allocated: ${total}%`;

  element.className =
    "pct-total " +
    (
      Math.abs(total - 100) <
      0.000001
        ? "good"
        : "bad"
    );
}

/* ============================================================
   ESCROW VALIDATION
   ============================================================ */

function validatePayloadValue() {
  const input =
    document.getElementById(
      "f-value",
    );

  const error =
    document.getElementById(
      "eth-validation",
    );

  if (!input) {
    return false;
  }

  if (!error) {
    console.warn(
      "eth-validation element not found.",
    );
  }

  const raw =
    input.value.trim();

  if (error) {
    error.style.display =
      "none";

    error.textContent = "";
  }

  input.classList.remove(
    "input-valid",
    "input-invalid",
  );

  /* Empty */

  if (!raw) {
    showEthError(
      "Please enter the escrow amount.",
    );

    return false;
  }

  /* Number */

  const amount =
    Number(raw);

  if (
    !Number.isFinite(amount)
  ) {
    showEthError(
      "Please enter a valid ETH amount.",
    );

    return false;
  }

  /* Greater than zero */

  if (amount <= 0) {
    showEthError(
      "Escrow amount must be greater than 0 ETH.",
    );

    return false;
  }

  /* Wallet */

  if (!currentWalletAddress) {
    showEthError(
      "Please connect your MetaMask wallet first.",
    );

    return false;
  }

  /* Balance */

  if (
    amount >
    currentEthBalance
  ) {
    showEthError(
      `Insufficient ETH balance. You need ${amount.toFixed(
        6,
      )} ETH, but your wallet has only ${currentEthBalance.toFixed(
        6,
      )} ETH.`,
    );

    return false;
  }

  input.classList.add(
    "input-valid",
  );

  return true;
}

function showEthError(message) {
  const error =
    document.getElementById(
      "eth-validation",
    );

  const input =
    document.getElementById(
      "f-value",
    );

  if (error) {
    error.textContent =
      message;

    error.style.display =
      "block";
  }

  if (input) {
    input.classList.add(
      "input-invalid",
    );
  }
}

/* ============================================================
   DEADLINE VALIDATION
   ============================================================ */

function setMinimumDeadline() {
  const input =
    document.getElementById(
      "f-deadline",
    );

  if (!input) {
    return;
  }

  const minimumDate =
    new Date(
      Date.now() +
        MIN_DEADLINE_MINUTES *
          60 *
          1000,
    );

  const year =
    minimumDate.getFullYear();

  const month =
    String(
      minimumDate.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      minimumDate.getDate(),
    ).padStart(2, "0");

  const hours =
    String(
      minimumDate.getHours(),
    ).padStart(2, "0");

  const minutes =
    String(
      minimumDate.getMinutes(),
    ).padStart(2, "0");

  input.min =
    `${year}-${month}-${day}T${hours}:${minutes}`;
}

function validateDeadline() {
  const input =
    document.getElementById(
      "f-deadline",
    );

  const error =
    document.getElementById(
      "deadline-validation",
    );

  const hint =
    document.getElementById(
      "deadline-info",
    );

  if (!input) {
    return false;
  }

  if (error) {
    error.style.display =
      "none";

    error.textContent = "";
  }

  input.classList.remove(
    "input-valid",
    "input-invalid",
  );

  if (!input.value) {
    showDeadlineError(
      "Please select a delivery deadline.",
    );

    return false;
  }

  const deadline =
    new Date(
      input.value,
    );

  if (
    Number.isNaN(
      deadline.getTime(),
    )
  ) {
    showDeadlineError(
      "Please enter a valid deadline.",
    );

    return false;
  }

  const minimumDeadline =
    new Date(
      Date.now() +
        MIN_DEADLINE_MINUTES *
          60 *
          1000,
    );

  if (
    deadline <=
    minimumDeadline
  ) {
    showDeadlineError(
      "Delivery deadline must be at least 1 hour from now.",
    );

    return false;
  }

  input.classList.add(
    "input-valid",
  );

  if (hint) {
    hint.textContent =
      "✅ Deadline is valid";

    hint.style.color =
      "var(--lime)";
  }

  return true;
}

function showDeadlineError(
  message,
) {
  const error =
    document.getElementById(
      "deadline-validation",
    );

  const input =
    document.getElementById(
      "f-deadline",
    );

  if (error) {
    error.textContent =
      message;

    error.style.display =
      "block";
  }

  if (input) {
    input.classList.add(
      "input-invalid",
    );
  }
}

/* ============================================================
   FINAL VALIDATION BEFORE BLOCKCHAIN
   ============================================================ */

async function validateAllAgreementInputs() {
  const nameInput =
    document.getElementById(
      "f-name",
    );

  const carrierSelect =
    document.getElementById(
      "f-carrier",
    );

  const cargoTypeInput =
    document.getElementById(
      "f-cargo-type",
    );

  const weightInput =
    document.getElementById(
      "f-weight",
    );

  const valueInput =
    document.getElementById(
      "f-value",
    );

  const deadlineInput =
    document.getElementById(
      "f-deadline",
    );

  /* ----------------------------------------------------------
     Required DOM
     ---------------------------------------------------------- */

  if (
    !nameInput ||
    !carrierSelect ||
    !cargoTypeInput ||
    !weightInput ||
    !valueInput ||
    !deadlineInput
  ) {
    alert(
      "One or more agreement fields are missing. Please reload the page.",
    );

    return false;
  }

  /* ----------------------------------------------------------
     Agreement name
     ---------------------------------------------------------- */

  const agreementName =
    nameInput.value.trim();

  if (!agreementName) {
    alert(
      "Please enter an agreement name.",
    );
    nameInput.focus();
    return false;
  }

  if (
    agreementName.length >
    MAX_AGREEMENT_NAME_LENGTH
  ) {
    alert(
      `Agreement name must be ${MAX_AGREEMENT_NAME_LENGTH} characters or fewer.`,
    );
    nameInput.focus();
    return false;
  }

  /* ----------------------------------------------------------
     Carrier
     ---------------------------------------------------------- */

  const carrierOption =
    carrierSelect.selectedOptions?.[0];

  if (
    !carrierOption ||
    !carrierOption.value
  ) {
    alert(
      "Please select a carrier.",
    );
    carrierSelect.focus();
    return false;
  }

  const carrierAddress =
    carrierOption.value.trim();

  if (
    !ethers.isAddress(
      carrierAddress,
    )
  ) {
    alert(
      "Invalid carrier wallet address.",
    );

    carrierSelect.focus();

    return false;
  }

  /* ----------------------------------------------------------
     Cargo type
     ---------------------------------------------------------- */

  const cargoType =
    cargoTypeInput.value.trim();

  if (!cargoType) {
    alert(
      "Please enter the cargo type.",
    );

    cargoTypeInput.focus();

    return false;
  }

  if (
    cargoType.length >
    MAX_CARGO_TYPE_LENGTH
  ) {
    alert(
      `Cargo type must be ${MAX_CARGO_TYPE_LENGTH} characters or fewer.`,
    );

    cargoTypeInput.focus();

    return false;
  }

  /* ----------------------------------------------------------
     Weight
     ---------------------------------------------------------- */

  const weightRaw =
    weightInput.value.trim();

  const weightKg =
    Number(weightRaw);

  if (
    !weightRaw ||
    !Number.isFinite(
      weightKg,
    ) ||
    weightKg <= 0
  ) {
    alert(
      "Cargo weight must be a valid number greater than 0 kg.",
    );

    weightInput.focus();

    return false;
  }

  if (
    weightKg >
    MAX_WEIGHT_KG
  ) {
    alert(
      "Cargo weight is too large.",
    );

    weightInput.focus();

    return false;
  }

  /* ----------------------------------------------------------
     Escrow
     ---------------------------------------------------------- */

  if (
    !validatePayloadValue()
  ) {
    return false;
  }

  /* ----------------------------------------------------------
     Deadline
     ---------------------------------------------------------- */

  if (
    !validateDeadline()
  ) {
    return false;
  }

  /* ----------------------------------------------------------
     Milestones
     ---------------------------------------------------------- */

  if (
    !validateMilestones()
  ) {
    goStep(2);
    return false;
  }

  /* ----------------------------------------------------------
     Authenticated Shipper
     ---------------------------------------------------------- */

  const authenticatedWallet =
    getAuthenticatedWallet();

  if (
    !authenticatedWallet ||
    !ethers.isAddress(
      authenticatedWallet,
    )
  ) {
    alert(
      "Authenticated Shipper wallet is not available.",
    );

    return false;
  }

  /* ----------------------------------------------------------
     MetaMask + Network + current account
     ---------------------------------------------------------- */

  try {
    const {
      chainId,
    } = await ensureSepoliaNetwork();

    console.log(
      "✅ Final network check:",
      chainId,
    );

    const accounts =
      await window.ethereum.request({
        method: "eth_accounts",
      });

    const activeWallet =
      accounts?.[0] || null;

    if (!activeWallet) {
      alert(
        "Please connect your MetaMask wallet first.",
      );

      return false;
    }

    if (
      activeWallet.toLowerCase() !==
      authenticatedWallet.toLowerCase()
    ) {
      alert(
        "Your MetaMask account does not match the authenticated Shipper account.",
      );

      return false;
    }

    /* --------------------------------------------------------
       Re-check selected carrier
       -------------------------------------------------------- */

    if (
      typeof window.checkUserRegistered !==
        "function" ||
      typeof window.getUserRole !==
        "function"
    ) {
      alert(
        "Blockchain carrier verification functions are unavailable.",
      );

      return false;
    }

    const registered =
      await window.checkUserRegistered(
        carrierAddress,
      );

    if (!registered) {
      alert(
        "The selected carrier is no longer registered on the current blockchain.",
      );

      return false;
    }

    const role =
      await window.getUserRole(
        carrierAddress,
      );

    if (
      !role ||
      role.role !== "Carrier"
    ) {
      alert(
        "The selected wallet is no longer a Carrier on the current blockchain.",
      );

      return false;
    }
  } catch (error) {
    console.error(
      "Final validation failed:",
      error,
    );

    alert(
      "Final blockchain validation failed: " +
        (
          error.reason ||
          error.message
        ),
    );

    return false;
  }

  return true;
}

/* ============================================================
   CREATE AGREEMENT
   ============================================================ */

async function submitCreateAgreement() {
  const valid =
    await validateAllAgreementInputs();

  if (!valid) {
    return;
  }

  try {
    /* --------------------------------------------------------
       Read validated values
       -------------------------------------------------------- */

    const agreementName =
      getElementValue(
        "f-name",
      );

    const carrierSelect =
      document.getElementById(
        "f-carrier",
      );

    const carrierOption =
      carrierSelect?.selectedOptions?.[0];

    const carrierAddress =
      carrierOption?.value?.trim();

    const cargoType =
      getElementValue(
        "f-cargo-type",
      );

    const weightKg =
      getElementValue(
        "f-weight",
      );

    const valueRaw =
      getElementValue(
        "f-value",
      );

    const deadlineValue =
      getElementValue(
        "f-deadline",
      );

    if (
      !agreementName ||
      !carrierAddress ||
      !cargoType ||
      !weightKg ||
      !valueRaw ||
      !deadlineValue
    ) {
      throw new Error(
        "Required agreement data is missing.",
      );
    }

    const totalAmountEth =
      Number(valueRaw);

    const deadlineDate =
      new Date(
        deadlineValue,
      );

    const deadlineTimestamp =
      Math.floor(
        deadlineDate.getTime() /
          1000,
      );

    /* --------------------------------------------------------
       Prepare milestones
       -------------------------------------------------------- */

    const paymentPercentages =
      milestones.map(
        (milestone) =>
          Number(
            milestone.pct,
          ),
      );

    const descriptions =
      milestones.map(
        (milestone) =>
          milestone.desc.trim(),
      );

    /* --------------------------------------------------------
       Authenticated shipper
       -------------------------------------------------------- */

    const shipperWallet =
      getAuthenticatedWallet();

    if (
      !shipperWallet ||
      !ethers.isAddress(
        shipperWallet,
      )
    ) {
      throw new Error(
        "Authenticated Shipper wallet is unavailable.",
      );
    }

    /* --------------------------------------------------------
       Final MetaMask verification
       -------------------------------------------------------- */

    const accounts =
      await window.ethereum.request({
        method: "eth_accounts",
      });

    const activeWallet =
      accounts?.[0] || null;

    if (!activeWallet) {
      throw new Error(
        "MetaMask wallet is not connected.",
      );
    }

    if (
      activeWallet.toLowerCase() !==
      shipperWallet.toLowerCase()
    ) {
      throw new Error(
        "MetaMask account does not match the authenticated Shipper account.",
      );
    }

    /* --------------------------------------------------------
       Blockchain transaction
       -------------------------------------------------------- */

    console.log(
      "⏳ Creating agreement on blockchain...",
    );

    const blockchainResult =
      await createAgreement(
        carrierAddress,
        totalAmountEth,
        deadlineTimestamp,
        descriptions,
        paymentPercentages,
      );

    console.log(
      "✅ Agreement created on blockchain:",
      blockchainResult,
    );

    if (
      !blockchainResult ||
      blockchainResult.agreementId ===
        undefined ||
      !blockchainResult.transactionHash
    ) {
      throw new Error(
        "Blockchain transaction succeeded but agreement result is incomplete.",
      );
    }

    /* --------------------------------------------------------
       Save metadata to database
       -------------------------------------------------------- */

    const token =
      getAuthToken();

    if (!token) {
      throw new Error(
        "Authentication token required.",
      );
    }

    console.log(
      "💾 Saving agreement metadata...",
    );

    const dbResponse =
      await fetch(
        "/api/agreements/create",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            onchainId:
              blockchainResult.agreementId,

            carrier:
              carrierAddress,

            totalAmountEth:
              totalAmountEth,

            descriptions:
              descriptions,

            percentages:
              paymentPercentages,

            deadlineTimestamp:
              deadlineTimestamp,

            createTx:
              blockchainResult.transactionHash,

            cargoType:
              cargoType,

            weightKg:
              weightKg,

            agreementName:
              agreementName,
          }),
        },
      );

    if (!dbResponse.ok) {
      let errorData = {};

      try {
        errorData =
          await dbResponse.json();
      } catch (_) {
        // Ignore invalid JSON.
      }

      console.error(
        "Database synchronization failed:",
        errorData,
      );

      throw new Error(
        errorData.error ||
          errorData.message ||
          "Failed to save agreement metadata.",
      );
    }

    const databaseResult =
      await dbResponse.json();

    console.log(
      "✅ Agreement saved:",
      databaseResult,
    );

    /* --------------------------------------------------------
       Success
       -------------------------------------------------------- */

    alert(
      "Agreement created successfully!\n\n" +
        "Waiting for the carrier to accept the agreement.",
    );

    window.location.href =
      "agreement_details_shipper.html?id=" +
      blockchainResult.agreementId;
  } catch (error) {
    console.error(
      "❌ Agreement creation error:",
      error,
    );

    alert(
      error.reason
        ? `Blockchain Error: ${error.reason}`
        : error.message ||
          "Failed to create agreement.",
    );
  }
}

/* ============================================================
   REVIEW PAGE
   Null-safe to prevent:
   Cannot set properties of null (setting 'textContent')
   ============================================================ */

function fillReview() {
  const nameInput =
    document.getElementById(
      "f-name",
    );

  const carrierSelect =
    document.getElementById(
      "f-carrier",
    );

  const valueInput =
    document.getElementById(
      "f-value",
    );

  const deadlineInput =
    document.getElementById(
      "f-deadline",
    );

  const cargoTypeInput =
    document.getElementById(
      "f-cargo-type",
    );

  const weightInput =
    document.getElementById(
      "f-weight",
    );

  const setText =
    (
      id,
      value,
    ) => {
      const el =
        document.getElementById(
          id,
        );

      if (el) {
        el.textContent =
          value;
      }
    };

  /* Agreement name */

  setText(
    "rv-name",
    nameInput?.value?.trim() ||
      "Logistics Agreement",
  );

  /* Carrier */

  setText(
    "rv-carrier",
    carrierSelect
      ?.selectedOptions?.[0]
      ?.textContent
      ?.trim() ||
      "Not selected",
  );

  /* Value */

  const value =
    valueInput?.value?.trim() ||
    "0.00";

  setText(
    "rv-value",
    `${value} ETH`,
  );

  /* Deadline */

  const deadline =
    deadlineInput?.value ||
    "";

  setText(
    "rv-deadline",
    deadline
      ? new Date(
          deadline,
        ).toLocaleString()
      : "Not set",
  );

  /* Cargo */

  setText(
    "rv-cargo-type",
    cargoTypeInput?.value?.trim() ||
      "Not specified",
  );

  /* Weight */

  const weight =
    weightInput?.value?.trim() ||
    "";

  setText(
    "rv-weight",
    weight
      ? `${weight} kg`
      : "Not specified",
  );

  /* Milestones */

  const wrap =
    document.getElementById(
      "rv-milestones",
    );

  if (!wrap) {
    return;
  }

  wrap.innerHTML = "";

  milestones.forEach(
    (milestone, index) => {
      const amount =
        (
          (
            Number(value) *
            Number(
              milestone.pct ||
                0,
            )
          ) /
          100
        ).toFixed(4);

      const row =
        document.createElement(
          "div",
        );

      row.className =
        "mini-milestone";

      row.innerHTML = `
        <div>
          <div class="name">
            ${index + 1}. ${
              milestone.name ||
              "Milestone"
            }
          </div>

          <div class="sub">
            ${
              milestone.desc ||
              "No description"
            }
          </div>
        </div>

        <div class="pct">
          ${Number(
            milestone.pct ||
              0,
          )}%
          (${amount} ETH)
        </div>
      `;

      wrap.appendChild(row);
    },
  );
}

/* ============================================================
   WALLET BALANCE
   ============================================================ */

async function loadWalletBalance() {
  const balanceInfo =
    document.getElementById(
      "eth-balance-info",
    );

  const walletAddress =
    getAuthenticatedWallet();

  if (
    !walletAddress ||
    !ethers.isAddress(
      walletAddress,
    )
  ) {
    currentWalletAddress =
      null;

    currentEthBalance =
      0;

    if (balanceInfo) {
      balanceInfo.textContent =
        "Wallet Balance: Wallet not connected";
    }

    return;
  }

  try {
    if (!window.ethereum) {
      throw new Error(
        "MetaMask is not installed.",
      );
    }

    const provider =
      new ethers.BrowserProvider(
        window.ethereum,
      );

    currentWalletAddress =
      walletAddress;

    const balance =
      await provider.getBalance(
        walletAddress,
      );

    currentEthBalance =
      Number(
        ethers.formatEther(
          balance,
        ),
      );

    if (balanceInfo) {
      balanceInfo.textContent =
        `Wallet Balance: ${currentEthBalance.toFixed(
          6,
        )} ETH`;
    }

    validatePayloadValue();
  } catch (error) {
    console.error(
      "Failed to load ETH balance:",
      error,
    );

    currentEthBalance =
      0;

    if (balanceInfo) {
      balanceInfo.textContent =
        "Wallet Balance: Unable to load";
    }
  }
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

function initCreateAgreement() {
  setMinimumDeadline();

  loadWalletBalance().then(
    () => {
      validatePayloadValue();
    },
  );

  loadCarriersFromBlockchain();

  validateDeadline();

  /* Escrow */

  const valueInput =
    document.getElementById(
      "f-value",
    );

  if (valueInput) {
    valueInput.addEventListener(
      "input",
      validatePayloadValue,
    );
  }

  /* Deadline */

  const deadlineInput =
    document.getElementById(
      "f-deadline",
    );

  if (deadlineInput) {
    deadlineInput.addEventListener(
      "input",
      validateDeadline,
    );
  }

  /* Wallet connection */

  window.addEventListener(
    "walletConnected",
    () => {
      loadWalletBalance();
      loadCarriersFromBlockchain();
    },
  );

  /* Network/account changes */

  if (window.ethereum) {
    window.ethereum.on(
      "accountsChanged",
      () => {
        loadWalletBalance();
        loadCarriersFromBlockchain();
      },
    );

    window.ethereum.on(
      "chainChanged",
      () => {
        loadCarriersFromBlockchain();
      },
    );
  }

  console.log(
    "✅ Create Agreement page initialized with full validation.",
  );
}

/* ============================================================
   SPA EXPORT
   ============================================================ */

window.initCreateAgreement =
  initCreateAgreement;

window.loadCarriersFromBlockchain =
  loadCarriersFromBlockchain;

window.nextFromStep1 =
  nextFromStep1;

window.nextFromStep2 =
  nextFromStep2;

window.renderMilestones =
  renderMilestones;

window.addMilestone =
  addMilestone;

window.validatePayloadValue =
  validatePayloadValue;

window.validateDeadline =
  validateDeadline;

window.validateMilestones =
  validateMilestones;

window.fillReview =
  fillReview;

window.submitCreateAgreement =
  submitCreateAgreement;

/* ============================================================
   DIRECT PAGE FALLBACK
   ============================================================ */

if (
  document.getElementById(
    "f-carrier",
  )
) {
  if (
    document.readyState ===
      "complete" ||
    document.readyState ===
      "interactive"
  ) {
    initCreateAgreement();
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      initCreateAgreement,
    );
  }
}