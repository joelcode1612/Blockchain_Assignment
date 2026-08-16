let selectedRole = null;

function togglePw(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === "password" ? "text" : "password";
}

function goRegStep(step) {
  [1, 2, 3].forEach((i) => {
    const el = document.getElementById("reg-step-" + i);
    if (el) el.classList.toggle("active", i === step);
  });
  document
    .querySelectorAll("#regDots .dot-bar")
    .forEach((dot, i) => dot.classList.toggle("on", i < step));
}

function selectRole(el) {
  document
    .querySelectorAll(".role-card")
    .forEach((card) => card.classList.remove("selected"));
  el.classList.add("selected");
  selectedRole = el.dataset.role;
  document.getElementById("regRoleContinue").disabled = false;
}

async function finishRegister() {
  try {
    // =====================================================
    // GET FORM VALUES
    // =====================================================

    const name = document.getElementById("regDisplayName").value.trim();

    const email = document.getElementById("regEmail").value.trim();

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!name) {
      alert("Please enter your display name.");
      return;
    }

    if (!email) {
      alert("Please enter your email.");
      return;
    }

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (!selectedRole) {
      alert("Please select a role.");
      goRegStep(2);
      return;
    }

    // =====================================================
    // REGISTER WALLET ON BLOCKCHAIN
    // =====================================================

    console.log("Selected role:", selectedRole);

    const result = await registerBlockchainUser(selectedRole);

    const walletAddress = result.wallet;

    console.log("Registration result:", result);

    // =====================================================
    // SAVE USER TO DATABASE
    // =====================================================

    console.log("Saving user to database...");

    const dbResponse = await fetch("/api/auth/register", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        walletAddress: walletAddress,

        role: selectedRole,

        displayName: name,

        email: email,

        signature: result.signature,

        message: result.message,
      }),
    });

    // =====================================================
    // HANDLE BACKEND ERROR
    // =====================================================

    if (!dbResponse.ok) {
      const errorData = await dbResponse.json();

      console.error("🚨 Backend registration error:", errorData);

      throw new Error(errorData.message || "Failed to create account.");
    }

    // =====================================================
    // DATABASE RESULT
    // =====================================================

    const userData = await dbResponse.json();

    console.log("User created:", userData);

    // =====================================================
    // SAVE FRONTEND SESSION INFORMATION
    // =====================================================

    localStorage.setItem("traxenWallet", walletAddress);

    localStorage.setItem("traxenUserName", name);

    localStorage.setItem("traxenUserEmail", email);

    localStorage.setItem("traxenUserRole", selectedRole);

    // =====================================================
    // SUCCESS
    // =====================================================

    alert("Account created successfully as " + selectedRole + "!");

    // =====================================================
    // REDIRECT
    // =====================================================

    if (selectedRole === "Shipper") {
      window.location.href = "/shipper";
    } else if (selectedRole === "Carrier") {
      window.location.href = "/carrier";
    }
  } catch (error) {
    console.error("Registration error:", error);

    if (error && error.reason) {
      alert(error.reason);
    } else {
      alert(error.message || "Registration failed.");
    }
  }
}

function doLogin() {
  const address = localStorage.getItem("traxenWallet");
  if (!address) {
    alert("Please connect your wallet first.");
    return;
  }

  localStorage.setItem("traxenWallet", address);

  const role = localStorage.getItem("traxenUserRole") || "Shipper";
  window.location.href = "/" + role.toLowerCase();
}

function selectWallet(el, ctx) {
  el.parentElement
    .querySelectorAll(".wallet-opt")
    .forEach((w) => w.classList.remove("selected"));
  el.classList.add("selected");

  const status = document.getElementById(ctx + "WalletStatus");
  const walletName = el.querySelector(".wallet-name").textContent;
  status.className = "status-line connecting";
  status.innerHTML =
    '<div class="status-dot"></div><span>Connecting to ' +
    walletName +
    "…</span>";

  setTimeout(() => {
    status.className = "status-line connected";
    status.innerHTML = '<div class="status-dot"></div> ...';
    if (ctx === "reg") setTimeout(() => goRegStep(2), 500);
    if (ctx === "login") setTimeout(() => handleLogin(), 500);
  }, 900);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("reg-step-1")) goRegStep(1);
});

function handleLogout(event) {
  event.preventDefault();

  localStorage.removeItem("traxenWallet");
  localStorage.removeItem("traxenUserName");
  localStorage.removeItem("traxenUserRole");
  sessionStorage.clear();

  if (window.userWalletAddress) {
    window.userWalletAddress = null;
  }

  window.location.href = "/";
}

async function handleRegisterWalletConnection(element) {
  try {
    const address = await connectWallet();

    document
      .querySelectorAll(".wallet-opt")
      .forEach((wallet) => wallet.classList.remove("selected"));

    element.classList.add("selected");

    const status = document.getElementById("regWalletStatus");
    status.className = "status-line connected";
    status.innerHTML =
      '<div class="status-dot"></div>' +
      "<span>Connected · " +
      truncateAddress(address) +
      "</span>";

    const walletAddressEl = document.getElementById("regWalletAddr");
    if (walletAddressEl) {
      walletAddressEl.textContent = address;
    }

    setTimeout(() => goRegStep(2), 500);
  } catch (error) {
    console.error(error);
  }
}

function showAuthFeedback(message, type = "error") {
  const alertEl = document.getElementById("authAlert");
  if (!alertEl) return;

  alertEl.className = `auth-alert ${type}`;
  alertEl.innerHTML =
    type === "error"
      ? `<span>⚠️ ${message}</span>`
      : `<span>✓ ${message}</span>`;
}

async function handleLogin() {
  try {
    if (!window.ethereum) {
      showAuthFeedback(
        "MetaMask is not installed. Please install it to continue.",
        "error",
      );
      return;
    }

    const loginResult = await blockchainLogin();

    if (loginResult.success && loginResult.authenticated) {
      showAuthFeedback("Login successful! Redirecting...", "success");

      localStorage.setItem("traxenWallet", loginResult.wallet);
      localStorage.setItem("traxenUserRole", loginResult.role);

      setTimeout(() => {
        window.location.href = "/" + loginResult.role.toLowerCase();
      }, 1200);
    } else {
      showAuthFeedback(
        "Wallet not recognized. Please register first.",
        "error",
      );
    }
  } catch (err) {
    showAuthFeedback(err.message || "Failed to authenticate wallet.", "error");
  }
}
